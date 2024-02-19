import localtunnel from "localtunnel"
import Bonjour from "@homebridge/ciao"

type TunnelArgs = {
  name?: string;
  type?: string;
  host?: string;
  port?: number;
}

export const startTunnel = async ({ 
  port = 8000,
  name = "Hue HDMI Sync",
  type = "hue-hdmi-sync", 
  host = "https://lt.josemunoz.dev"
}: TunnelArgs) => {
  const bonjour = Bonjour.getResponder()
  const tunnel = await localtunnel({ port, host })
  const broadcast = bonjour.createService({
    port,
    name,
    type,
    txt: {
      url: tunnel.url,
    }
  })
  
  broadcast.advertise()
  console.log(`tunneling to ${tunnel.url}`)

  return () => {
    tunnel.close()
    broadcast.end().then(() => {
      broadcast.destroy()
    })
  }
}
