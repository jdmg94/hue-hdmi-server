import { Hono } from "hono";
import Boom from "@hapi/boom";
import Bonjour from "@homebridge/ciao";
import { Worker } from "worker_threads";
import { serve } from "@hono/node-server";
import HueSync, { EntertainmentArea, BridgeClientCredentials } from "hue-sync";

import chunk from "./utils/chunk";
import sleep from "./utils/sleep";
import {
  persistNewCredentials,
  getRegisteredCredentials,
} from "./utils/credentialHelpers";

enum ServerStatus {
  NOT_READY = "not ready",
  READY = "ready",
  IDLE = "idle",
  WORKING = "working",
  ERROR = "error",
}

type ServerState = {
  Variables: {
    status: ServerStatus;
    credentials?: BridgeClientCredentials;
    bridge?: HueSync;
    entertainmentArea?: EntertainmentArea;
  }
}

export async function startWeb(tunnelUrl, port = 8080) {
  const bonjour = Bonjour.getResponder()
  const router = new Hono<ServerState>()
  const worker = new Worker("./build/CVWorker")


  const broadcast = bonjour.createService({
    port,
    name: "Hue HDMI Sync",
    type: "hue-hdmi-sync",
    txt: {
      url: tunnelUrl,
    }
  })

  router.use("*", async (context, next) => {
    const credentials = await getRegisteredCredentials()

    // define initial state
    context.set('credentials', credentials)
    context.set('status', ServerStatus.NOT_READY)
    return next()
  })

  router.get("/check", (context) => {
    const status = context.get('status')

    return context.json({
      status,
    })
  })

  router.get("/discovery", async (context) => {
    const devices = await HueSync.discover()

    return context.json(devices)
  })

  type RegisterArgs = {
    ip: string;
    name?: string;
  }

  router.post("/register", async (context) => {
    const reqBody = await context.req.json<RegisterArgs>();

    const ip = reqBody.ip
    const name = reqBody.name || "hue-hdmi-sync"

    const nextCredentials = await HueSync.register(ip, name)

    await persistNewCredentials(nextCredentials)

    context.set('credentials', nextCredentials)

    return context.json({
      status: "ok",
    })
  })

  router.get("/entertainment-areas", async (context) => {
    const bridge = context.get('bridge')
    if (!bridge) {
      const notInitializedException =
        Boom.preconditionFailed("Not Initialized!").output

      context.status(notInitializedException.statusCode)
      return context.json({
        status: "ERROR",
        payload: notInitializedException.payload,
      })
    } else {
      const data = await bridge.getEntertainmentAreas()
      const result = data?.map((item) => ({ id: item.id, name: item.name })) || []

      return context.json(result)
    }
  })

  router.get("/stream/:id", async (context) => {
    const bridge = context.get('bridge')
    if (!bridge) {
      const notReadyException = Boom.preconditionFailed(
        "Not Ready to Stream!"
      ).output;

      context.status(notReadyException.statusCode)
      return context.json({
        status: "ERROR",
        payload: notReadyException.payload,
      })
    } else {
      worker.on("message", (message) => {
        const colorData = chunk<number>(message, 3)

        bridge.transition(colorData as Array<[number, number, number]>)
      })

      const id = context.req.param('id');
      const area = await bridge.getEntertainmentArea(id);

      await bridge.start(area);
      worker.postMessage("start");

      context.set('status', ServerStatus.WORKING)

      return context.json({
        status: ServerStatus.WORKING,
      })
    }
  })

  router.get("/stop", async (context) => {
    const bridge = context.get('bridge')
    const noSocketException = Boom.preconditionFailed("No Active Stream!");
    if (!bridge) {
      context.status(noSocketException.output.statusCode)

      return context.json(noSocketException.output.payload)
    }

    try {
      worker.postMessage("stop")
      worker.removeAllListeners()

      await sleep(500)

      bridge.stop()
      context.set('status', ServerStatus.IDLE)

      return context.json({
        status: "ok",
      })
    } catch {
      context.status(noSocketException.output.statusCode)

      return context.json(noSocketException.output.payload)
    }
  })

  router.put("/quick-start", async (context) => {
    const reqBody = await context.req.json();
    const credentials = {
      clientkey: reqBody.key,
      username: reqBody.user,
    }

    const bridge = new HueSync({
      credentials,
      id: reqBody.id,
      url: reqBody.ip,
    })

    await persistNewCredentials(credentials)
    context.set('bridge', bridge)
    context.set('status', ServerStatus.READY)

    return context.json({
      status: ServerStatus.READY,
    })
  })

  broadcast.advertise();
  const server = serve({
    ...router,
    port,
  })

  return () => {
    server.close()
    broadcast.end().then(() => {
      broadcast.destroy()
    })
  }
}
