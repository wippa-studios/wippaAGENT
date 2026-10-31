# Networking

- Draw the topology before you build it. The picture is where the missing hop and the accidental flat network become visible.
- Segment by tier and by trust. The database tier should not be reachable from the internet tier at all.
- Use security groups or network ACLs with a default deny and explicit allows. A rule that opens a range is a rule that will be forgotten.
- Plan the address space so the subnets do not collide with the ranges you will need later, including the ranges your VPN and your container platform will consume.
- Keep a routing table you can explain. A route added for one temporary problem becomes permanent.
- Use a transit gateway or its equivalent for the many-to-many case, and peering for the point-to-point one.
- Put the egress path through a controlled gateway where the compliance story requires it, and log it.
- Terminate TLS with modern ciphers, redirect the plaintext port, and enable HTTP/2 and HTTP/3 where the clients support them.
- Keep the load balancer in front of the service for health checking, draining, and termination, not only for distribution.
- Set a health check that reflects real readiness, and a drain time longer than the longest request.
- Design DNS with a sensible TTL strategy. A long TTL makes a migration slow, a short TTL makes a resolver storm. Change the TTL before the change you are making.
- Enable DNSSEC where you control the zone, and monitor the resolution path rather than only the authoritative servers.
- Use flow logs and packet capture to answer questions after an incident. Troubleshooting without visibility is guessing.
