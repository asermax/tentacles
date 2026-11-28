# [1.5.0](https://github.com/asermax/tentacles/compare/v1.4.0...v1.5.0) (2026-11-28)


### Bug Fixes

* **claude-relay:** log every signal the relay receives, not only the first ([33fb4cd](https://github.com/asermax/tentacles/commit/33fb4cded8a775c34c1051d17475a96064cfff84))
* **provider-cloudflare:** do not log a failure for a call the run itself ended ([e19d594](https://github.com/asermax/tentacles/commit/e19d5942055c776887bf9d926b51bec4f82d74f1))
* **provider-cloudflare:** read the time through Effect's Clock in the Claude object ([508e757](https://github.com/asermax/tentacles/commit/508e757f7f3e47213bc1b4185ca1c957c98b0e16))
* **provider-cloudflare:** take a call off the count when any step before the relay fails ([b7246c4](https://github.com/asermax/tentacles/commit/b7246c4d40d23db610a7204c4d57c1bc293b4898))


### Features

* **claude-relay:** shut down on SIGTERM and SIGINT and survive failures outside a call ([a3fdc82](https://github.com/asermax/tentacles/commit/a3fdc82a409bf9ffe24e57df4d26cbf042671558))
* **claude-relay:** track each call, log it and report its end to the Claude object ([a8a006e](https://github.com/asermax/tentacles/commit/a8a006ea18c1ffd0d6e27e388edd92f3a901d24d))
* **provider-cloudflare:** count each Claude call and hold calls while the container stops ([c23dd10](https://github.com/asermax/tentacles/commit/c23dd1097c07842a43fc2c19ba93a311c0b832c0))
* **provider-cloudflare:** fail a lost Claude call through one function that logs it ([d02edd2](https://github.com/asermax/tentacles/commit/d02edd2ce627a410178457636879e016cd83d10f))
* **provider-cloudflare:** keep the Claude object up while its container runs and stop the container after 15 idle minutes ([8e773e4](https://github.com/asermax/tentacles/commit/8e773e4f62f1c84deb28f9f8855a9fbe82c86133))
* **provider-cloudflare:** take a call off the Claude object's count when the relay reports its end ([5e21300](https://github.com/asermax/tentacles/commit/5e213007e4501299d9a0d7bff579f9e5aa990bec))
* **relay-protocol:** add the package that defines the relay's wire protocol ([6df5c23](https://github.com/asermax/tentacles/commit/6df5c23eac35416e0125b54d94a2561b13ac915e))

# [1.4.0](https://github.com/asermax/tentacles/compare/v1.3.0...v1.4.0) (2026-11-27)


### Bug Fixes

* **core:** name the reason a subagent did not answer ([f3e8261](https://github.com/asermax/tentacles/commit/f3e826121d857bf8ae267c1913b25bb74b1f5b00))
* **provider-cloudflare:** create the repository, skills and context folders at setup when nothing fills them ([8e7cc97](https://github.com/asermax/tentacles/commit/8e7cc97f0a696bb836d94d18c2950f6bedfe1c22))
* **provider-cloudflare:** import each Computer adapter from its own module ([90f2ce6](https://github.com/asermax/tentacles/commit/90f2ce648d5cfae4b24deae1fa270692f45835fa))
* **provider-cloudflare:** make Node trust the interception CA in container commands ([9e5b2d2](https://github.com/asermax/tentacles/commit/9e5b2d201d8346b009397ce664ebd7a25e9a09fd))
* **provider-cloudflare:** put mise's default shims directory on the workspace image's PATH ([9eebcfd](https://github.com/asermax/tentacles/commit/9eebcfd9b4ea97d8e7f29307f9c7cafed7e01bd6))
* **provider-cloudflare:** reset the session object once it has deleted itself ([2da97f0](https://github.com/asermax/tentacles/commit/2da97f09d776a497657dc62dd1346ac8e18d36cc))
* **provider-cloudflare:** run the workspace object's setup and destroy one at a time ([6277769](https://github.com/asermax/tentacles/commit/62777697b1dfe4166ebb9909f401803e019668f6))
* **provider-cloudflare:** send the GitHub token only on HTTPS requests ([ba48609](https://github.com/asermax/tentacles/commit/ba4860953bba31eae0d1e8f5c8d6c09cccf5da35))
* **provider-cloudflare:** start the workspace container at the size the session asked for ([a526660](https://github.com/asermax/tentacles/commit/a526660bdcbdbb198ee37bdec04b8bece905aa25))


### Features

* add the call that deletes one session ([a53b6cb](https://github.com/asermax/tentacles/commit/a53b6cbbb5ccfc576fc6ae693d3d9245f783e839))
* **contracts:** replace the workspace contract with tools, create and forward ([f28581b](https://github.com/asermax/tentacles/commit/f28581b60b7e7e89adb617dad3fe3b5b3d21ed87))
* **core:** keep a failed registry entry when the workspace setup fails ([a832a48](https://github.com/asermax/tentacles/commit/a832a48d96832b01a64f2fc3a5ab426751f2c5ea))
* **core:** name the workspace's directories in the remote agent's instructions ([51c31ef](https://github.com/asermax/tentacles/commit/51c31ef2f8d87c2826d440cb9e684dd764fe6180))
* **plugin:** drop the workspace lifetime and the repository check and point context at /workspace/context ([39b47a9](https://github.com/asermax/tentacles/commit/39b47a943db7dbdabd9723c0f56f57dbf0404612))
* **provider-cloudflare:** add the Workspace Worker and its workspace object ([3336ac8](https://github.com/asermax/tentacles/commit/3336ac8dcefeac8ce04832aa3a074b60da0782c6))
* **provider-cloudflare:** route the workspace container's egress through the Workspace Worker's gateway ([355624a](https://github.com/asermax/tentacles/commit/355624a072f1cf552afba03744de80facc66544b))
* **provider-cloudflare:** work the session's workspace through its workspace object ([20bab60](https://github.com/asermax/tentacles/commit/20bab6063349a082a5c7c53e978ccdf298849aaa))


### Performance Improvements

* **provider-cloudflare:** clone the repository while the archive files are written ([d00e3a2](https://github.com/asermax/tentacles/commit/d00e3a29633ae9feb69cf9ac325de3be93c9a044))

# [1.3.0](https://github.com/asermax/tentacles/compare/v1.2.0...v1.3.0) (2026-11-15)


### Features

* **provider-cloudflare:** add toolchain prerequisites and mise to the workspace image ([9534e53](https://github.com/asermax/tentacles/commit/9534e537df830e2c784859fd9d9dbfa70c39ad5c))

# [1.2.0](https://github.com/asermax/tentacles/compare/v1.1.0...v1.2.0) (2026-11-15)


### Bug Fixes

* **core:** do not prompt a commit when the end-of-run check fails ([6441a33](https://github.com/asermax/tentacles/commit/6441a331e1109d75127a059db377b8513fb6cbbc))
* **provider-cloudflare:** read a session object without a container as a stopped workspace ([28aeb99](https://github.com/asermax/tentacles/commit/28aeb9914f17b3be194afc659f5dff4a788dadd1))


### Features

* **core:** carry the repository check on questions and ask on a failing workspace ([52de78c](https://github.com/asermax/tentacles/commit/52de78cb20c7ca38176ea31b5992e23f0e33fdd1))
* **plugin:** show the question's repository check in the wake and protocol ([96742ee](https://github.com/asermax/tentacles/commit/96742ee7be8e3f32a71f0cc16abb33f9af722bf7))
* **plugin:** spawn with glm-5.3 and standard-2 by default ([18e8efd](https://github.com/asermax/tentacles/commit/18e8efd372e94375a61d7ed43be5070e8ccee3dc))
* **provider-cloudflare:** start the workspace daemon with the deploy's commit identity ([f19a606](https://github.com/asermax/tentacles/commit/f19a60664ae2ef9f1b8987a01e424f6198d1c3da))

# [1.1.0](https://github.com/asermax/tentacles/compare/v1.0.0...v1.1.0) (2026-11-14)


### Bug Fixes

* **plugin:** drop the on-disk SKILL.md of a symlinked skill folder by its real path ([ad8b5da](https://github.com/asermax/tentacles/commit/ad8b5dae53b3f749cea115e827e03efb9969f55a))
* **plugin:** pack a skill folder from its real path so a symlinked parent folder packs SKILL.md once ([4b40749](https://github.com/asermax/tentacles/commit/4b4074907c5d4efaa1a79b0b0d0db831347c1a96))
* **provider-cloudflare:** store the context archive under its own key and test create with context ([752b78d](https://github.com/asermax/tentacles/commit/752b78d6c4cba4815e51559e3fd4192539ca980d))


### Features

* **core:** carry context files to a session and expand them into /context ([c36022f](https://github.com/asermax/tentacles/commit/c36022f2f9871f3234e81c2b606c7fd5e60f4b64))
* **plugin:** send context files and folders with spawn ([77c1ad7](https://github.com/asermax/tentacles/commit/77c1ad7266f6aac167cddda8320d8e31c55a67d2))

# 1.0.0 (2026-11-13)


### Bug Fixes

* **core:** expand a skill trigger only when it stands on its own ([8f0ec57](https://github.com/asermax/tentacles/commit/8f0ec57d8a9b872009823522ae615e2b30c97b70))
* **core:** keep a question waiting through any number of evictions ([51b412d](https://github.com/asermax/tentacles/commit/51b412d0c2b0970b5631436001a5030907966fb8))
* **core:** keep the workspace up for pending work only in a managed repository ([8fb13d3](https://github.com/asermax/tentacles/commit/8fb13d3b516879c1f4ac8a3bec14b55f552f780e))
* **core:** let only the model call ask_parent ([8634641](https://github.com/asermax/tentacles/commit/8634641a98bbec319e3e0f77d470225c3f9a726b))
* **core:** read a session's record and state in one snapshot ([663d027](https://github.com/asermax/tentacles/commit/663d027cee7d47937973b6da3f5a6cedabe46663))
* **core:** reset the commit prompts only when a prompt starts a run ([2c3d4b7](https://github.com/asermax/tentacles/commit/2c3d4b7c6917cb8f8fc87158fdb8364320962d88))
* **core:** skip the end-of-run commit check when the workspace container is not running ([8360392](https://github.com/asermax/tentacles/commit/8360392fedec0d0b47cc01bb1325a893b59b776d))
* **core:** start the workspace on the first operation of a tool call ([8a91e51](https://github.com/asermax/tentacles/commit/8a91e514e1604370e372ed7a87971ae2686cae6c))
* **plugin:** add the marketplace from its claude-marketplace branch ([3d12732](https://github.com/asermax/tentacles/commit/3d12732e70121a59f05a3400402385e0c46683dd))
* **plugin:** format the archive size limit with megabytes ([7550cbb](https://github.com/asermax/tentacles/commit/7550cbb30686f4c3545ec28c4a1b0e6d8f4f73ca))
* **plugin:** name the tools as Claude Code shows them and make the repository optional in the skill ([f278a82](https://github.com/asermax/tentacles/commit/f278a82b88e6b12d3b896f94d1fd817afb8aba40))
* **plugin:** reject agent files that share a file name before create ([c4c4086](https://github.com/asermax/tentacles/commit/c4c40861c273b46760d26b0298025abb3e0aa8f3))
* **plugin:** return a wake that went out before the wait to the next wait ([15cf0f0](https://github.com/asermax/tentacles/commit/15cf0f00ecb2c68640974852c376c41d8232491a))
* **plugin:** stop telling the Claude skill there is no wait tool ([b07e11c](https://github.com/asermax/tentacles/commit/b07e11cef9fa2d3fe23797a3ba5d54790f769de4))
* **plugin:** wake the parent for changes it missed while it was away ([ecea4ec](https://github.com/asermax/tentacles/commit/ecea4ec7e40eabcc8ccb812360f1ff187e378298))
* **provider-cloudflare:** bundle and load the Worker the way the deploy does ([a164220](https://github.com/asermax/tentacles/commit/a1642200647d0e01662ab69e784a2d20b94fb148))
* **provider-cloudflare:** forward previews to the workspace over plain HTTP ([00f0bf3](https://github.com/asermax/tentacles/commit/00f0bf37a0c6e5438916bc61eecaa9e2421b87ac))
* **provider-cloudflare:** pin ws to chord's peer so the Worker bundles one pi-env ([c445705](https://github.com/asermax/tentacles/commit/c4457057031ac7844a1ba37403ed5be801cfe2ed))
* **provider-cloudflare:** register the Claude object in the Worker's init ([81bf5db](https://github.com/asermax/tentacles/commit/81bf5db08901ff614e377943188e9c68fa6ed246))
* **provider-cloudflare:** send a normal close for a dropped CDP relay side ([4ecb5be](https://github.com/asermax/tentacles/commit/4ecb5be199d06a4f2dc702ed44a08157a4cb5b92))
* **provider-cloudflare:** start each container with its published image ([c0fc2b0](https://github.com/asermax/tentacles/commit/c0fc2b0fe1c384f1eaaad62dc6a849bbc0402cc5))
* **provider-cloudflare:** track every remote branch in a shallow clone ([db2117f](https://github.com/asermax/tentacles/commit/db2117fb1f204eaa0f045d710d543022419ce422))
* **worker-api:** quote only the frontmatter values that fail strict YAML ([46801fa](https://github.com/asermax/tentacles/commit/46801fae9555f7be64e87c363cc7deb350e2c72a))
* **worker-api:** say what is wrong with a skill or agent name, description and body ([e137796](https://github.com/asermax/tentacles/commit/e1377965d26ad858a2a9ad339009e51e20a09669))


### Features

* **claude-relay:** add the claude relay server ([00c994d](https://github.com/asermax/tentacles/commit/00c994d1b79f21e045171f83c627d14a84730d63))
* **contracts:** add the SkillsArchive service and pass session details to the registry ([f200b62](https://github.com/asermax/tentacles/commit/f200b62c0cc0cad88a8bffddfe0662ac24ac07d2))
* **contracts:** declare the provider contracts as Effect services ([53965e4](https://github.com/asermax/tentacles/commit/53965e47597ffacd19829577795209ff14b77862))
* **contracts:** fail Workspace.ensure, Browser.open and RegistryStore with tagged errors ([ed9fc38](https://github.com/asermax/tentacles/commit/ed9fc3833de75fb944d955f9ffc1504396321c98))
* **core:** add the agents extension and an agent argument to the subagent tool ([62c2f5e](https://github.com/asermax/tentacles/commit/62c2f5ef77fa81a61547e6acf270d33202a080fd))
* **core:** add the ask_parent question tool ([1368a61](https://github.com/asermax/tentacles/commit/1368a618af1c0c7d0f4d858cceae5bf82b692d09))
* **core:** add the daily cleanup job ([ee1ddda](https://github.com/asermax/tentacles/commit/ee1dddafc33f9748881a832a00711a9f9320dcd2))
* **core:** add the preview tool and the preview route's handler ([9e79d21](https://github.com/asermax/tentacles/commit/9e79d21ab11de1e03a3e0f0fd88af02066498c00))
* **core:** add the session with its record and derived status ([e80dc91](https://github.com/asermax/tentacles/commit/e80dc91ebbb6d886744d04f72b7e08644b4024e6))
* **core:** add the skills extension with its section, the skill tool and trigger expansion ([293de0e](https://github.com/asermax/tentacles/commit/293de0e7ff5659f24f203f6c77599481ea1948db))
* **core:** give tools the workspace through pi-env and check pending work ([f29872e](https://github.com/asermax/tentacles/commit/f29872e211767f10aecc9268ea8f0b67cd8e7a35))
* **core:** install the remote agent's tools and instructions ([1193711](https://github.com/asermax/tentacles/commit/1193711d65a09260b7ea324b39764bd523d1aea0))
* **core:** log the failures pi-durable reports ([914834b](https://github.com/asermax/tentacles/commit/914834babf6c65184814cfc1e3836fde72ea00c4))
* **core:** prompt the agent to commit when a run ends with pending work ([e8712f9](https://github.com/asermax/tentacles/commit/e8712f9843c49598fad33daa93b19924ec3f914d))
* **core:** read both archives together in create and report both failures ([2e4298b](https://github.com/asermax/tentacles/commit/2e4298be1ba7219bee08bedf0ebb75c595413287))
* **core:** read the skills and agents archives at create and carry their names in the session state ([d10f58e](https://github.com/asermax/tentacles/commit/d10f58ec61242c5dd3cab7ca870f75d5cd2bf901))
* **core:** return tagged structured results from ask_parent and preview ([12f87c5](https://github.com/asermax/tentacles/commit/12f87c5f9b920330b738b591f7b3ac54ad58727b))
* **core:** serve the sessions API group over SessionHost and the registry ([e42dfbf](https://github.com/asermax/tentacles/commit/e42dfbf6ee400c7404704827914dbf037c222ab1))
* **deploy:** add the stack that runs the chosen provider ([4e04cc5](https://github.com/asermax/tentacles/commit/4e04cc5e7e55500b786b0aa01043940e87c02cbe))
* **plugin:** add the pi extension, the Claude mod and the skill text ([49d5c8b](https://github.com/asermax/tentacles/commit/49d5c8bf13e16ab053f007c74e0f39677e4bb32d))
* **plugin:** add the tool table, the parent controller and the helper CLI ([6126f41](https://github.com/asermax/tentacles/commit/6126f410c0a2ce49a945d5e0fbd91d642d6896d4))
* **plugin:** default to the cloudflare provider and the default image ([a8f0d83](https://github.com/asermax/tentacles/commit/a8f0d832d2685aa876d88a8042e7cac6a888d6d6))
* **plugin:** keep each file's permission bits in the skills and agents archives ([54a674b](https://github.com/asermax/tentacles/commit/54a674bb95ab34007ca0bdd8689edda6ec535e28))
* **plugin:** pack skill folders and agent files into spawn's create call ([c9d90f7](https://github.com/asermax/tentacles/commit/c9d90f736ddc20a177b65e3708270625476f4de9))
* **provider-cloudflare:** add the claude container image ([5c59c34](https://github.com/asermax/tentacles/commit/5c59c346911cd3dbe47d2b803ad74a79db5e9962))
* **provider-cloudflare:** add the Cloudflare provider's Worker, objects and stack ([9b5cfbf](https://github.com/asermax/tentacles/commit/9b5cfbf7532bb72994daec5c4eb6a0a1beba20ac))
* **provider-cloudflare:** add the workspace container image ([0a820c9](https://github.com/asermax/tentacles/commit/0a820c92a6ba88df5f00c819ebb768aa1384352e))
* **provider-cloudflare:** expand the skills archive into /skills after the workspace's clone ([2295ed7](https://github.com/asermax/tentacles/commit/2295ed7da732bb32c30cf552cdbfc88fdbcab85d))
* **provider-cloudflare:** keep the skills archive in the session object's key-value storage ([15a62cc](https://github.com/asermax/tentacles/commit/15a62cc02ccef11da1540083ea933107defc9ec9))
* **provider-cloudflare:** run core's sessions, preview and cleanup in the Worker ([5130993](https://github.com/asermax/tentacles/commit/51309938592605922dee31c90e55a0aafc8ec706))
* **sql-registry:** add the drizzle registry store with its rules ([c1644f1](https://github.com/asermax/tentacles/commit/c1644f19f59a3de04fae5add7c56bd6d48631e9a))
* **sql-registry:** store and list each session's settings and skill and agent names ([3354b47](https://github.com/asermax/tentacles/commit/3354b47b187f744dcf0720b8cd350cf4a53a5889))
* **worker-api:** accept frontmatter values that strict YAML rejects ([ef491d7](https://github.com/asermax/tentacles/commit/ef491d7967b08698e62c6cdeb0faefa9f3fe452a))
* **worker-api:** accept skills and agents archives in create and read their definitions ([f17e270](https://github.com/asermax/tentacles/commit/f17e270ebec194615ffdea893455145a036d0f27))
* **worker-api:** add tagged-union helpers to SessionState and Entry ([3672b12](https://github.com/asermax/tentacles/commit/3672b12144c1ccd780d682958ab8ac0315c1a857))
* **worker-api:** declare the tentacles HTTP API ([636d2f7](https://github.com/asermax/tentacles/commit/636d2f7ce4b8ca78e6f039697556a692bf3cb068))
* **worker-api:** export the message count schema ([a246fad](https://github.com/asermax/tentacles/commit/a246fad992e5d16ce04965a2ec14df4c69bf2c8b))
* **worker-api:** reject a repository URL that is not http or https ([3693d88](https://github.com/asermax/tentacles/commit/3693d8879593ccabb826311b0301e2ab62329b73))
* **worker-api:** require an agent's name to match its file name ([e3d6406](https://github.com/asermax/tentacles/commit/e3d6406fc6efa7462ff90ebacf8150f431c4e571))


### Performance Improvements

* **core:** read the session's skill and agent names alongside the observers ([6ceb356](https://github.com/asermax/tentacles/commit/6ceb3560160eba5e3ee51d0c6d7e4dc1ead144c1))
* **core:** read the skills document only when a prompt names a held skill ([eda8216](https://github.com/asermax/tentacles/commit/eda8216298bf9f72bb9c5d98ee31b1ac9cd46c3a))
* **provider-cloudflare:** build the API handler once in the Worker's init ([3327d4d](https://github.com/asermax/tentacles/commit/3327d4d8a08ea6cfb66ad20202ae7f1fe8801c41))
* **provider-cloudflare:** run the clone and the skills extraction together on a cold start ([3d8ff89](https://github.com/asermax/tentacles/commit/3d8ff89ca225526f5975947918ec465f553de8fd))
