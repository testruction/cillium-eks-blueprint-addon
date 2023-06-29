# cilium-eks-blueprint-add

This module is a Cilium addon for https://github.com/aws-quickstart/cdk-eks-blueprints.

# Cilium on EKS

Cilium is a networking, observability, and security solution with an eBPF-based dataplane. It provides a simple flat Layer 3 network with the ability to span multiple clusters in either a native routing or overlay mode. It is L7-protocol aware and can enforce network policies on L3-L7 using an identity based security model that is decoupled from network addressing.

Cilium implements distributed load balancing for traffic between pods and to external services, and is able to fully replace kube-proxy, using efficient hash tables in eBPF allowing for almost unlimited scale. It also supports advanced functionality like integrated ingress and egress gateway, bandwidth management and service mesh, and provides deep network and security visibility and monitoring.

A new Linux kernel technology called [eBPF](https://ebpf.io/) is at the foundation of Cilium. It supports dynamic insertion of eBPF bytecode into the Linux kernel at various integration points such as: network IO, application sockets, and tracepoints to implement security, networking and visibility logic. eBPF is highly efficient and flexible. To learn more about eBPF, visit [BPF.io](https://ebpf.io/).

This example deploys the following resources

* Creates EKS Cluster Control plane with public endpoint (for demo purpose only) with a managed node group
* Deploys supporting add-ons: ClusterAutoScaler, AwsLoadBalancerController, VpcCni, CoreDns, KubeProxy, EbsCsiDriver
* Deploy Kube-Prometheurs on the EKS cluster

## Prerequisites:

Ensure that you have installed the following tools on your machine.

1. [aws cli](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html)
2. [kubectl](https://Kubernetes.io/docs/tasks/tools/)
3. [cdk](https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install)
4. [npm](https://docs.npmjs.com/cli/v8/commands/npm-install)

## Deploy EKS Cluster with Amazon EKS Blueprints for CDK

Clone the repository

```sh
git clone https://github.com/aws-samples/cdk-eks-blueprints-patterns.git
```

Create a CDK project, Bootstrap your environment and install dependency

```sh
cdk init app --language typescript
cdk bootstrap aws://<AWS_ACCOUNT_ID>/<AWS_REGION>
npm i @aws-quickstart/eks-blueprints
npm i cilium-eks-bluprints-addon

```

Replace the contents of bin/<your-main-file>.ts  with the following:
```typescript
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import * as blueprints from '@aws-quickstart/eks-blueprints';
import * as CiliumAddon from '@testruction/cilium-eks-blueprints-addon';
const app = new cdk.App();
// AddOns for the cluster.
const addOns: Array<blueprints.ClusterAddOn> = [
    new blueprints.addons.MetricsServerAddOn,
    new blueprints.addons.ClusterAutoScalerAddOn,
    new blueprints.addons.AwsLoadBalancerControllerAddOn(),
    new blueprints.addons.VpcCniAddOn(),
    new blueprints.addons.CoreDnsAddOn(),
    new blueprints.addons.KubeProxyAddOn(),
    new blueprints.addons.EbsCsiDriverAddOn(),
    new CiliumAddon()
];
const account = 'XXXXXXXXXXXXX'
const region = 'your region'
const props = { env: { account, region } }
new blueprints.EksBlueprint(app, { id: 'cilium-eks', addOns}, props)
```

Deploy the stack using the following command

```sh
cdk deploy
```

## Verify the resources

Let’s verify the resources created by Steps above.

```bash
kubectl get nodes  # Output shows the EKS Managed Node group nodes

kubectl get ns | kube-system  # Output shows kubeflow namespace

kubectl get pods --namespace=kue-system  # Output shows kubeflow pods
```


## Access Cilium dashboards

log into Grafana UI by creating a port-forward to the grafana service<br>

```sh
kubectl -n monitoring port-forward svc/blueprints-addon-prometheus-grafana 50080:80
```

and open this browser: http://localhost:50080/

## Cleanup

To clean up your EKS Blueprints, run the following commands:

```sh
cdk destroy --all
```