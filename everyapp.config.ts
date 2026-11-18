import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "talking-video-ads",
  name: "Talking Video Ads",
  description:
    "Turn ad scripts into videos of a person speaking them, one at a time or as batches of hook, actor and language variations.",
  resources: {
    d1: ["DB"],
    r2: ["files"],
  },
  // Replicate calls back when a generation step finishes, and reads the
  // actor portrait for the video step. Each job has its own token in the path.
  public: [
    { path: "/hooks/replicate/:adId/:token", methods: ["POST"] },
    { path: "/hooks/replicate/:adId/:token/portrait", methods: ["GET"] },
  ],
  capabilities: {
    replicate: {
      access: "read",
      why: "Translates scripts, makes the speech and animates the actor's portrait.",
    },
  },
  features: {
    generation: {
      name: "Video generation",
      why: "Makes the videos. Without it, actors and drafts still work.",
      capabilities: ["replicate"],
      steps: [
        "Create a Replicate API token: https://replicate.com/account/api-tokens",
        "Run `everyapp provider add replicate` and paste the token.",
      ],
    },
  },
});
