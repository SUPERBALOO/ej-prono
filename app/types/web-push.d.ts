declare module "web-push" {
  export type PushSubscription = {
    endpoint: string;
    keys?: {
      p256dh?: string;
      auth?: string;
    };
  };

  export type VapidKeys = {
    publicKey: string;
    privateKey: string;
  };

  export type WebPushError = Error & {
    statusCode?: number;
  };

  const webPush: {
    setVapidDetails(
      subject: string,
      publicKey: string,
      privateKey: string
    ): void;

    sendNotification(
      subscription: PushSubscription,
      payload?: string
    ): Promise<unknown>;

    generateVAPIDKeys(): VapidKeys;
  };

  export default webPush;
}
