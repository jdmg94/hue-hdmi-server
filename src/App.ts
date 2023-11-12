import Koa from "koa";
import Boom from "@hapi/boom";
import { koaBody } from "koa-body";
import KoaRouter from "@koa/router";
import Bonjour from "@homebridge/ciao";
import { Worker } from "worker_threads";
import HueSync, { EntertainmentArea } from "hue-sync";

import chunk from "./utils/chunk";
import sleep from "./utils/sleep";
import {
  persistNewCredentials,
  getRegisteredCredentials,
} from "./utils/credentialHelpers";

type HueWebState = {
  isActive: boolean;
  bridge?: HueSync;
  entertainmentArea?: EntertainmentArea;
};

enum ServerStatus {
  NOT_READY = "not ready",
  READY = "ready",
  IDLE = "idle",
  WORKING = "working",
  ERROR = "error",
}

export async function startWeb(port = 8080) {
  const app = new Koa();
  const router = new KoaRouter();
  const bonjour = Bonjour.getResponder();
  const controller = new AbortController();
  const worker = new Worker("./build/CVWorker");
  let credentials = await getRegisteredCredentials();
  let serverStatus = ServerStatus.NOT_READY;

  const state: HueWebState = {
    isActive: false,
    bridge: undefined,
    entertainmentArea: undefined,
  };

  app.use(koaBody());
  app.use(router.routes());
  app.use(
    router.allowedMethods({
      throw: true,
      notImplemented: () => Boom.notImplemented(),
      methodNotAllowed: () => Boom.methodNotAllowed(),
    })
  );

  const broadcast = bonjour.createService({
    port,
    name: "Hue HDMI Sync",
    type: "hue-hdmi-sync",
  });

  worker.on("message", (message) => {
    const colorData = chunk<number>(message, 3);

    state.bridge!.transition(colorData as Array<[number, number, number]>);
  });

  router.get("/check", (context) => {
    context.body = {
      status: serverStatus,
    };
  });

  router.get("/discovery", async (context) => {
    const devices = await HueSync.discover();

    context.body = devices;
  });

  router.post("/register", async (context) => {
    const ip = context.request.body.ip;
    const name = context.request.body.name || "hue-hdmi-sync";

    const nextCredentials = await HueSync.register(ip, name);

    await persistNewCredentials(nextCredentials);

    credentials = nextCredentials;
    context.body = {
      status: "ok",
    };
  });

  router.get("/entertainment-areas", async (context) => {
    if (!state.bridge) {
      const notInitializedException =
        Boom.preconditionFailed("Not Initialized!").output;

      context.status = notInitializedException.statusCode;
      context.body = {
        status: "ERROR",
        payload: notInitializedException.payload,
      };
    } else {
      const data = await state.bridge?.getEntertainmentAreas();

      context.body = data.map((item) => ({ id: item.id, name: item.name }));
    }
  });

  router.get("/stream/:id", async (context) => {
    if (!state.bridge) {
      const notReadyException = Boom.preconditionFailed(
        "Not Ready to Stream!"
      ).output;

      context.status = notReadyException.statusCode;
      context.body = {
        status: "ERROR",
        payload: notReadyException.payload,
      };
    } else {
      const area = await state.bridge?.getEntertainmentArea(context.params.id);

      await state.bridge.start(area);
      worker.postMessage("start");

      serverStatus = ServerStatus.WORKING;

      state.isActive = true;
      context.body = {
        status: serverStatus,
      };
    }
  });

  router.get("/stop", async (context) => {
    const noSocketException = Boom.preconditionFailed("No Active Stream!");
    if (!state.bridge) {
      context.status = noSocketException.output.statusCode;
      context.body = noSocketException.output.payload;
      return;
    }

    try {
      worker.postMessage("stop");
      await sleep(500);
      state.bridge?.stop();

      serverStatus = ServerStatus.IDLE;

      state.isActive = false;
      context.body = {
        status: "ok",
      };
    } catch {
      context.status = noSocketException.output.statusCode;
      context.body = noSocketException.output.payload;
    }
  });

  router.put("/quick-start", async (context) => {
    credentials = {
      clientkey: context.request.body.key,
      username: context.request.body.user,
    };
    state.bridge = new HueSync({
      id: context.request.body.id,
      credentials,
      url: context.request.body.ip,
    });

    await persistNewCredentials(credentials);

    serverStatus = ServerStatus.READY;

    context.body = {
      status: serverStatus,
    };
  });

  broadcast.advertise();
  app.listen({
    host: "0.0.0.0",
    port,
    signal: controller.signal,
  });

  return () => {
    controller.abort();
    broadcast.end().then(() => {
      broadcast.destroy();
    });
  };
}
