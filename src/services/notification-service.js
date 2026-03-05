/**
 * Notification payload
 *
 * @typedef {Object} NotificationPayload
 * @property {string} message - The notification message body
 * @property {string} [title] - Optional notification title
 */

/**
 * Abstract base class for notification services
 *
 * Provides a common interface for multiple notification destinations
 * such as Discord and Slack. Each concrete service must extend this
 * class and implement the `send` method.
 *
 * @abstract
 */
export class NotificationService {
  /**
   * Send a notification
   *
   * @param {NotificationPayload} _payload - The notification content
   * @returns {Promise<void>}
   * @abstract
   */
  async send(_payload) {
    throw new Error("Subclass must implement send()");
  }

  /**
   * Returns the name of the notification service
   *
   * @returns {string}
   * @abstract
   */
  get name() {
    throw new Error("Subclass must implement name");
  }
}
