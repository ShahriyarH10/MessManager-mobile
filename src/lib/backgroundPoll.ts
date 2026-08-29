/**
 * Background polling.
 *
 * Foreground polling (see AppServices) only runs while the app is open, so
 * notifications used to appear only when you entered the app. This registers an
 * OS background task that wakes the app roughly every 15 min (Android: reliable
 * via WorkManager; iOS: the system decides, often only in long idle windows) to
 * run the same broadcast / meal-update check and raise a local notification.
 *
 * It is NOT instant push — that would need FCM + a server sender. This is the
 * serverless middle ground.
 *
 * `expo-task-manager` / `expo-background-task` are native modules. They are
 * loaded through `require` inside a try/catch so that a JS bundle which somehow
 * lands on a build without them (a mistaken OTA) degrades to foreground-only
 * polling instead of crashing on launch.
 */
import type * as TaskManagerT from 'expo-task-manager';
import type * as BackgroundTaskT from 'expo-background-task';
import { initSession, getSession } from './session';
import { checkForNewBroadcasts, checkForMealUpdates } from './push';

export const BG_POLL_TASK = 'mm-background-poll';

let TaskManager: typeof TaskManagerT | null = null;
let BackgroundTask: typeof BackgroundTaskT | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  TaskManager = require('expo-task-manager');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  BackgroundTask = require('expo-background-task');
} catch {
  TaskManager = null;
  BackgroundTask = null;
}

if (TaskManager && BackgroundTask) {
  try {
    TaskManager.defineTask(BG_POLL_TASK, async () => {
      try {
        // The background JS context is fresh — the in-memory session is empty.
        if (!getSession()) await initSession();
        if (!getSession()?.user) return BackgroundTask!.BackgroundTaskResult.Success;
        // canPrompt = false: never raise a permission dialog from the background.
        await checkForNewBroadcasts(false);
        await checkForMealUpdates(false);
        return BackgroundTask!.BackgroundTaskResult.Success;
      } catch {
        return BackgroundTask!.BackgroundTaskResult.Failed;
      }
    });
  } catch {
    /* defineTask unavailable */
  }
}

/** Register the task once the user is signed in. Safe to call repeatedly. */
export async function registerBackgroundPoll(): Promise<void> {
  if (!TaskManager || !BackgroundTask) return;
  try {
    if ((await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Restricted) {
      return;
    }
    if (await TaskManager.isTaskRegisteredAsync(BG_POLL_TASK)) return;
    await BackgroundTask.registerTaskAsync(BG_POLL_TASK, { minimumInterval: 15 });
  } catch {
    /* unavailable (Expo Go / simulator) — foreground polling still covers it */
  }
}

export async function unregisterBackgroundPoll(): Promise<void> {
  if (!TaskManager || !BackgroundTask) return;
  try {
    if (await TaskManager.isTaskRegisteredAsync(BG_POLL_TASK)) {
      await BackgroundTask.unregisterTaskAsync(BG_POLL_TASK);
    }
  } catch {
    /* ignore */
  }
}
