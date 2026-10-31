# Constrained-device firmware

**What to do**

- Budget memory before writing features. Know the flash and RAM budget, the per-task stack allocation, and the headroom you are willing to keep. Measure the map output, do not estimate it.

**The working stack**

- Processor families: ARM Cortex-M, STM32, the ESP32 and ESP8266 wireless parts, the Nordic nRF range, PIC, AVR, and RISC-V designs, plus the parts with a hardware floating point unit and the ones without.
- Real-time options: FreeRTOS, Zephyr, RT-Thread and Mbed for a scheduler, and bare metal where the task set is small enough that a scheduler is pure overhead.
- Peripherals and buses: I2C, SPI, UART, CAN, Modbus, and the radio protocols, plus direct memory access for bulk transfers, plus timers, watchdogs and the clock tree.
- Tooling: JTAG and serial-wire debugging, an oscilloscope and a logic analyser for the timing claims, a linker map for the size and stack figures, and a bootloader with checksum or signature validation, a rollback slot and a firmware update path.
- Choose bare metal or an RTOS deliberately. FreeRTOS, Zephyr, RT-Thread and Mbed each suit different constraints; an RTOS on a project that needs twenty microseconds of deterministic latency is overhead, and bare metal on a project with fifteen tasks is a rewrite waiting to happen.
- Keep hardware access behind a hardware abstraction layer so the same logic runs on the development host and the target.
- Design interrupts and tasks to a priority scheme, and give the highest priority work the tightest deadline. Measure worst-case interrupt latency on the target, not the average.
- Use DMA for bulk transfers so the CPU is not the bottleneck, and size buffers for the DMA behaviour of the specific peripheral.
- Include a watchdog, and give it a real recovery path rather than a blind reset.
- Plan the bootloader for field reality: image validation with a checksum or signature, a rollback slot, and an update path that cannot brick the device.

**What to watch for**

- Power, not just performance. Deep sleep modes, clock gating, and batching of radio transmissions usually decide battery life far more than code efficiency.
- Flash wear. Every write cycle counts against the erase budget.
- Stack overflow in interrupt context, which uses the main stack unless configured otherwise.
- Heap fragmentation and dynamic allocation in a system that must run for years.
- Floating point in hot paths on parts without a hardware FPU.

**How to verify**

- Static analysis of the built image for size, plus a stack usage analysis per task.
- Worst-case latency measurement on hardware with an oscilloscope or logic analyser, across several runs.
- A soak test of the full duty cycle for longer than the longest field interval.
- Hardware-in-the-loop tests for the paths that matter, not just host unit tests.

