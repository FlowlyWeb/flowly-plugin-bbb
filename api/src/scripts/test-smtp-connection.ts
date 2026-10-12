/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EmailService } from '../emails/email.service';

async function testSmtpConnection() {
  console.log('🔧 Initializing application context...');

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const emailService = app.get(EmailService);

    console.log('📡 Testing SMTP connection...');
    const isConnected = await emailService.testConnection();

    if (isConnected) {
      console.log('✅ SMTP connection successful!');
      console.log('📧 Your email configuration is working correctly.');
    } else {
      console.log('❌ SMTP connection failed!');
      console.log('🔍 Check your EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASSWORD settings.');
    }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    console.error('💥 Error during SMTP test:', (error as any).message);
    console.log('🔍 This might indicate a configuration problem or network issue.');
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  testSmtpConnection()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}
