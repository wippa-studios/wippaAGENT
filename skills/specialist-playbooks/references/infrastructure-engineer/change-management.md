# Change management

- Write the change down before you make it: what, why, how it is verified, how it is rolled back, and who is affected.
- Classify the change by risk and apply the matching control. A routine change and a change to the identity boundary should not travel the same path.
- Require a second pair of eyes for anything that removes, replaces, or re-permissions something.
- Separate the change from the approval. The person who reviews the change should not be the person who applies it.
- Schedule risky work in a window with the people who can respond awake.
- Announce the change to the teams it affects, before it happens.
- Keep an audit trail that says who ran what, when, and with which plan. A log of apply invocations is the minimum.
- Roll back rather than patch forward when the change is not working. Patching forward during an incident creates a second thing that can go wrong.
- After a failed change, write down what made it surprising, and change the process so the next person is not surprised by the same thing.
