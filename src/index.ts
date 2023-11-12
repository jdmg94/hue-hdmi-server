import { startWeb } from "./App"

const init = async () => {
  const port = 8080
  const closeServer = await startWeb(port)
  console.log(`listening on port ${port}!`)


  const closeGracefully: NodeJS.SignalsListener = (signal) => {
    console.log(`*^!@4=> Received signal to terminate: ${signal}`)

    closeServer()
    // await other things we should cleanup nicely
    process.kill(process.pid, signal)
  }

  process.once("SIGINT", closeGracefully)
  process.once("SIGTERM", closeGracefully)
}

init()
