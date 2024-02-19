import { startWeb } from "./App"
import localtunnel from "localtunnel"

const init = async () => {
  const port = 3000
  const host = "https://lt.josemunoz.dev"
  const tunnel = await localtunnel({ port, host })
  const closeServer = await startWeb(tunnel.url, port)

  console.log(`listening on port ${port}!`)
  console.log(`tunneling to ${tunnel.url}`)

  const closeGracefully: NodeJS.SignalsListener = (signal) => {
    console.log(`*^!@4=> Received signal to terminate: ${signal}`)

    tunnel.close()
    closeServer()

    // await other things we should cleanup nicely
    process.kill(process.pid, signal)
  }

  process.once("SIGINT", closeGracefully)
  process.once("SIGTERM", closeGracefully)
}

const tryAgain = (e: Error) => {
  console.log(`something went wrong! ${e.message}`)
  init().catch(tryAgain)
}

init().catch(tryAgain)
