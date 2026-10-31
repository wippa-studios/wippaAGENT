# Fleet-scale connected device platforms

**What to do**

- Design the device identity first. Per-device certificates with a managed rotation and a revocation path, not a shared password baked into firmware.

**The working stack**

- Protocols: MQTT over TLS as the default uplink, MQTT-SN for the constrained radio cases, CoAP for the strictly request-and-response endpoints, LoRaWAN for long range, narrowband IoT for cellular, Zigbee for the mesh, Bluetooth Low Energy for the personal area, and Wi-Fi, cellular and satellite where the device has power and budget for them.
- Platforms: AWS IoT Core, Azure IoT Hub, Google Cloud's device registry, ThingsBoard for the open-source path, and the hosted platforms from Losant and Particle.
- Fleet features: per-device certificates with automated rotation and revocation, device twins or shadows for the desired and reported state, staged over-the-air update with an abort threshold, time synchronisation, and local buffering with resynchronisation for the devices that lose connectivity.
- Provision devices through a factory step that enrols each unit uniquely, then enforce that enrolment at first boot.
- Use MQTT over TLS as the default uplink for constrained devices, with MQTT-SN where the radio makes it necessary, and CoAP where the endpoint model is strictly request and response.
- Push aggregation to the edge. A gateway that filters, aggregates, and translates protocols before the cloud sees the traffic is what makes fleets affordable.
- Design for disconnection. Devices lose connectivity, so buffer locally, resynchronise on reconnect, and make the cloud side tolerate out-of-order and duplicated messages.
- Build the telemetry pipeline to be inspectable. Store the raw payload alongside the parsed fields, because device firmware changes and you will need the original.

**What to watch for**

- Battery life against the reporting interval, which is the single largest operating cost in most fleets.
- Over-the-air update failures. An update that leaves a subset of devices bricked is an outage with a delayed fuse.
- Clock skew. Devices without time synchronisation produce telemetry that cannot be ordered or correlated.
- Certificate expiry and the tooling to renew before it bites.
- Cost per device per month, including egress and message volume.

**How to verify**

- A soak of the fleet at representative scale, with message throughput, end-to-end latency and drop rate measured from the platform side.
- A staged update rehearsal on a device subset with a defined abort threshold and a tested rollback.
- Security review of the enrolment and credential storage path.
- A measured per-device monthly cost for a representative device class.

