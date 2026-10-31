# Hardening the scripting estate

**What to do**

- Configure remoting with least privilege. Use Just Enough Administration role definitions or constrained endpoints so that a connecting session can only run the commands it needs, rather than inheriting the full surface of the machine.

**The concrete settings**

- Credential storage: the SecretManagement module, the Azure key vault, DPAPI for machine-scoped secrets, and the credential locker for the interactive desktop. All four, and none of them a file on disk.
- Endpoint control: Just Enough Administration role definitions, constrained endpoints, and a listener configuration that limits the address range the host will accept connections from.
- Host baselines: the CIS and DISA STIG control sets for Windows, local administrator membership audited and reduced, the legacy SMB protocol disabled, LDAP signing required rather than negotiable, and NTLM disabled where the estate tolerates it.
- Scheduled tasks and service accounts: the stored-credential pattern removed, the account's least privilege defined, and the task's trigger and failure notification reviewed.
- Turn on the logging that makes an investigation possible: script block logging to record what was executed, module logging to record what each module did, and transcripts for the interactive sessions that matter.
- Set the execution policy deliberately and document it. The policy is a control, not an obstacle, and a policy that is set to unrestricted because it was inconvenient is a policy that has been defeated.
- Sign the scripts that run at scale, and publish them through a path that verifies the signature before execution.
- Store credentials properly, in the credential manager, the secret store, the key vault, or the platform data protection store, and never in the script, the command line, the history file, or the log.
- Harden the hosts themselves: review scheduled tasks that store credentials in their arguments, review service accounts and what they are allowed to do, and constrain the WinRM endpoints and the listeners.
- Apply the recognised Windows baselines through the same scripting you are securing, covering local administrator membership, firewall and protocol settings, the negotiation protocol, the legacy SMB protocol, and directory service signing requirements.
- Review the scripts themselves as code. Look for embedded credentials, plaintext secrets, credentials written into logs, unvalidated parameters, error handling that leaks the inner exception, and unsafe dynamic invocation or reflection.
- Put the checks into the pipeline as gates rather than as a document, so a new script that introduces a credential fails the build.

**What to watch for**

- Over-broad remote sessions that grant administrative rights to a network segment that does not need them.
- Logging that records the arguments of a command, which is how a secret ends up in a log file.
- Error handling that dumps the raw exception, the command line and the environment into a user-visible message.
- Dynamic invocation built from a string that came from user input, which is a command injection point.
- The legacy protocol settings that were never disabled and are still listening.

**How to verify**

- The configured roles and endpoints are enumerated and shown to grant only the intended commands.
- Logging is enabled and a test session is confirmed to appear in the logs.
- A credential-handling scan runs against the script set and returns nothing.
- The baseline settings are read back from the target and compared against the intended configuration.

**Change control and versioning of scripts**

- Keep the scripts in version control with the rest of the estate code, and treat a change to a scheduled task's script the same as a change to the task itself.
- Review the diff for a script change with the same care as a diff for an application, because the script runs with the privileges of whatever runs it.
- Give each script an owner, so that when the behaviour needs to change six months later, somebody knows who to ask.
- Record the schedule, the account, the privileges and the failure notification next to the script. A scheduled task with no owner and no alert is a task that fails silently until somebody notices a number is stale.
- Test the change against a copy of the target configuration before applying it to the live one, and keep the rollback script with the change.
- Keep the old version of a script alongside the new one until the new one has run successfully more than once. Replacing a scheduled script in place leaves nothing to roll back to.
- A deliberately weak script is submitted and the gate rejects it.

**Reviewing scripts as security-relevant code**

- Search for embedded secrets first: strings that look like a credential, a connection string with a password in it, a base64 blob that decodes to something, and a token pasted into a variable.
- Check the credential handling pattern. A credential read from a parameter typed as a plain string will end up in the transcript, and a credential passed on the command line ends up in the history file and in the process listing.
- Check the error handling. A catch block that writes the exception, the command and the environment into a log is a leak, and a catch block that swallows the error is worse, because it hides a failure that the operator needs to see.
- Check the dynamic invocation. Building a command name from a string that came from a parameter, a file, or a network response is a command injection point even when the string looks validated.
- Check the permission surface. Confirm the script requests only the rights it uses, and that the account it runs under has only those rights.
- Check the logging configuration. Script block logging and transcripts are what make an incident reconstructable, and a script that suppresses them removes the evidence.
- Check the pipeline surface. A script that publishes an artefact, opens a network listener, or writes to a shared path changes the exposure of the machine it runs on.

**Mapping to the recognised baselines**

- Where a compliance framework applies, map each control to the specific script and setting that satisfies it, so that an assessment can be answered with a reference rather than with a narrative.
- Keep the mapping in version control next to the scripts, and date it, because the baselines are revised and an undated mapping quietly becomes wrong.
- Automate the check where the check can be automated. A control that depends on someone remembering to look is not a control.
