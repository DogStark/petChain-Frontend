import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private initialized = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    if (admin.apps.length > 0) {
      this.initialized = true;
      return;
    }

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    // Handle newlines in private key
    let privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');
    if (privateKey) {
        privateKey = privateKey.replace(/\\n/g, '\n');
    }

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials not fully provided in env (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY). Firebase messaging will be disabled.');
      return;
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      this.initialized = true;
      this.logger.log('Firebase Admin SDK initialized successfully.');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error.stack);
    }
  }

  /**
   * Send a push notification to a specific device token
   */
  async sendToDevice(
    token: string,
    notification: { title: string; body: string; imageUrl?: string },
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.initialized) {
      this.logger.warn('FCM send aborted: Firebase not initialized.');
      return false;
    }

    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
          ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
        },
        data: data || {},
      };

      const response = await admin.messaging().send(message);
      this.logger.debug(`Successfully sent FCM message: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending FCM message to token ${token}`, error.stack);
      return false;
    }
  }

  /**
   * Send a push notification to multiple device tokens (multicast)
   */
  async sendToDevices(
    tokens: string[],
    notification: { title: string; body: string; imageUrl?: string },
    data?: Record<string, string>,
  ): Promise<admin.messaging.BatchResponse | null> {
      if (!this.initialized) {
          this.logger.warn('FCM multicast send aborted: Firebase not initialized.');
          return null;
      }
      
      if (!tokens || tokens.length === 0) return null;

      try {
          const message: admin.messaging.MulticastMessage = {
              tokens,
              notification: {
                title: notification.title,
                body: notification.body,
                ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
              },
              data: data || {},
          };

          const response = await admin.messaging().sendEachForMulticast(message);
          this.logger.debug(`Bulk FCM send result: ${response.successCount} successful, ${response.failureCount} failed out of ${tokens.length}`);
          return response;
      } catch (error) {
          this.logger.error(`Error sending multicultural FCM message`, error.stack);
          return null;
      }
  }
}
