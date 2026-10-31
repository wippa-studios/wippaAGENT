# Cost

- Tag everything from the first resource, because untagged cost from six months ago is unallocated cost from six months ago.
- Right-size from observed usage, not from the instance type somebody picked in a hurry.
- Use reservations and savings plans for the steady baseline, and spot or preemptible capacity for the interruptible work.
- Set a budget alert and a per-team view, so the cost conversation happens before the invoice.
- Delete the resources that nothing references. A forgotten load balancer, a detached volume, and an orphaned snapshot are the usual findings.
- Storage lifecycle policies and storage class transitions are cheaper than deleting a disk you needed to keep.
- Watch the data transfer line. Cross-region and cross-service transfer is where the surprise lives.
- Use autoscaling for the variable load, and a floor for the part that must stay warm.
- Track the cost of the platform itself, and make sure the platform is not more expensive than the toil it removes.
