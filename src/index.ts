import { startWeb } from "./App"
import localtunnel from 'localtunnel'

const init = async () => {
  const port = 3000
  const tunnel = await localtunnel({ port })
  const closeServer = await startWeb(port)
  
  
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

init()
