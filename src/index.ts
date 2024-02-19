import { startWeb } from "./router"
import { startTunnel } from "./tunnel"

const init = async () => {
  const port = 3000
  const closeServer = await startWeb(port)
  const closeTunnel = await startTunnel({ port })
  
  const closeGracefully: NodeJS.SignalsListener = (signal) => {
    console.log(`*^!@4=> Received signal to terminate: ${signal}`)

    closeTunnel()
    closeServer()

    // await other things we should cleanup nicely
    process.kill(process.pid, signal)
  }

  process.once("SIGINT", closeGracefully)
  process.once("SIGTERM", closeGracefully)
}

const tryAgain = (e: Error = undefined) => {
  if (e) {
    console.log(`something went wrong! ${e.message}`)
  }

  init().catch(tryAgain)
}

tryAgain()

