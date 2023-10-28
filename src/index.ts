import { startWeb } from "./App"

const init = () => {
  startWeb()

  const closeGracefully: NodeJS.SignalsListener = (signal) => {
    console.log(`*^!@4=> Received signal to terminate: ${signal}`)

    // await other things we should cleanup nicely
    process.kill(process.pid, signal)
  }

  process.once("SIGINT", closeGracefully)
  process.once("SIGTERM", closeGracefully)
}

init()
