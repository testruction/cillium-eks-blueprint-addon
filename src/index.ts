/**
 * Cilium for Amazon EKS Blueprint
 *
 * Description: This file contains the implementation of the Cilium network plugin for Amazon EKS Blueprint.
 * Cilium is an eBPF-based networking, security, and observability solution for Kubernetes.
 *
 * @author "Florian JUDITH <florian.judith.b@gmail.com>"
 * @version 0.0.1
 * Copyright (c) [2023], [Testruction.io]
 * All rights reserved.
 *
 */
import { Construct } from "constructs";
import assert from "assert";

import { ICertificate } from 'aws-cdk-lib/aws-certificatemanager';
import { ClusterInfo, Values } from "@aws-quickstart/eks-blueprints/dist/spi";
import { HelmAddOn, HelmAddOnUserProps } from "@aws-quickstart/eks-blueprints/dist/addons/helm-addon";
import { dependable, setPath } from "@aws-quickstart/eks-blueprints/dist/utils";
import { AwsLoadBalancerControllerAddOn } from "@aws-quickstart/eks-blueprints/dist/addons/aws-loadbalancer-controller";

import merge from "ts-deepmerge";

/**
 * User provided options for the Helm Chart
 */
export interface CiliumAddOnProps extends HelmAddOnUserProps {

    /**
     * To Create Namespace using CDK
     */
    createNamespace?: boolean;

    /**
     * Helm chart version to use to install.
     * @default 1.13.4
     */
    version?: string;

    /**
     * Values for the Helm chart.
     */
    values?: any;

    /**
     * Enable Load Balancer for Ingress - default is false
     */
    enableAlb?: boolean,

    /**
     * Name of the {@link certificateResourceName} to be used for certificate look up.
     * @see {@link ImportCertificateProvider} and {@link CreateCertificateProvider} for examples of certificate providers.
     */
    certificateResourceName?: string,
}

/**
 * Default props to be used when creating the Helm chart
 */
const defaultProps = {
    name: 'cilium',
    namespace: 'kube-system',
    chart: "cilium",
    version: "1.13.4",
    release: 'blueprints-addon-cilium',
    repository: "https://helm.cilium.io",
    values: {},
    createNamespace: true,
    enableAlb: false
};

/**
 * Main class to instantiate the Helm chart
 */
export class CiliumAddOn extends HelmAddOn {

    readonly options: CiliumAddOnProps;

    constructor(props?: CiliumAddOnProps) {
        super({...defaultProps  as any, ...props});
        this.options = this.props as CiliumAddOnProps;
    }

    @dependable('AwsLoadBalancerControllerAddOn')
    @dependable('ExternalsSecretsAddOn')
    deploy(clusterInfo: ClusterInfo): Promise<Construct> {
        const cluster = clusterInfo.cluster;
        const albAddOnCheck = clusterInfo.getScheduledAddOn(AwsLoadBalancerControllerAddOn.name);
        const enableAlb = this.options.enableAlb;
        const cert = this.options.certificateResourceName;

        /**
         * Recommended values from documentation:
         * https://docs.cilium.io/en/stable/installation/k8s-install-helm/#install-cilium
         */
        let values: Values = {
            config: {
                "eni": {
                    "enabled": true
                },
                "ipam": {
                    "mode": "eni"
                }
            },
            "egressMasqueradeInterfaces": "eth0",
            "tunnel": "disabled"
        };

        /**
         * Additionnal values
         */
        // If Load Balancing is enabled
        if (enableAlb){
            values = setUpLoadBalancer(clusterInfo, values, albAddOnCheck, cert);
        } else {
            assert(!cert, 'Cert option is supported only if ALB is enabled.');
        }

        // Merge values with user-provided one
        values = merge(values, this.props.values ?? {});

        // Apply Helm Chart
        const chart = this.addHelmChart(clusterInfo, values, false, false);

        return Promise.resolve(chart);
    }
}

/**
 * Helper function to set up Load Balancer
 */
function setUpLoadBalancer(clusterInfo: ClusterInfo, values: Values, albAddOnCheck: Promise<Construct> | undefined, cert: string | undefined ): Values {
    // Check to ensure AWS Load Balancer Controller AddOn is provided in the list of Addons
    assert(albAddOnCheck, `Missing a dependency: ${AwsLoadBalancerControllerAddOn.name}. Please add it to your list of addons.`);
    const presetAnnotations: any = {
        'alb.ingress.kubernetes.io/group.name': 'hubble',
        'alb.ingress.kubernetes.io/scheme': 'internet-facing',
        'alb.ingress.kubernetes.io/target-type': 'ip',
        'alb.ingress.kubernetes.io/listen-ports': '[{"HTTP": 80}]',
        'alb.ingress.kubernetes.io/healthcheck-path': '/health',
    };

    // Set helm custom value for certificates, if provided
    if (cert){
        presetAnnotations['alb.ingress.kubernetes.io/listen-ports'] = '[{"HTTP": 80},{"HTTPS":443}]';
        const certificate = clusterInfo.getResource<ICertificate>(cert);
        presetAnnotations['alb.ingress.kubernetes.io/certificate-arn'] = certificate?.certificateArn;
    }

    setPath(values, "hubble", {
        "enabled": "true",
        "ui": {
            "enabled": true,
            "ingress": {
                "enabled": true,
                "className": "alb",
                "annotations": presetAnnotations
            }
        }
    });

    return values;
}