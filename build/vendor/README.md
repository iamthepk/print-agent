# Optional bundled runtime binaries

This directory is copied into the packaged Electron app as `resources/vendor`.

Keep third-party executable binaries out of git unless redistribution and public
repository storage have been explicitly approved. Local/offline installer builds
may place approved tools here before running `npm run dist`.
