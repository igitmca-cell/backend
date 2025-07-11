import nodemailer from "nodemailer";
import twilio from "twilio";
import ejs from "ejs";
import path from "path";
import { fileURLToPath } from "url";


import { User } from "../models/user.model.js";
import {Expo} from "expo-server-sdk";
 
const expo = new Expo();
async function sendPushNotifications(title, body) {
    try {
      console.log(`Starting push notification process for title: "${title}"`);
  
      const batchSize = 1000; // Adjust based on server memory capacity
      let skip = 0;
      let hasMoreUsers = true;
      const processedTokens = new Set(); // To track unique tokens
  
      while (hasMoreUsers) {
        const users = await User.find({ expoPushToken: { $exists: true, $ne: null } })
          .skip(skip)
          .limit(batchSize)
          .lean();
  
        if (!users.length) {
          console.log('No more users with push tokens found');
          hasMoreUsers = false;
          break;
        }
  
        console.log(`Processing ${users.length} users from batch starting at ${skip}`);
  
        // Filter unique tokens and validate them
        const uniqueUsers = users.filter(user => {
          if (processedTokens.has(user.expoPushToken)) {
            return false; // Skip if token already processed
          }
          if (Expo.isExpoPushToken(user.expoPushToken)) {
            processedTokens.add(user.expoPushToken);
            return true;
          }
          return false;
        });
  
        if (!uniqueUsers.length) {
          console.log('No new valid push tokens in this batch');
          skip += batchSize;
          continue;
        }
  
        console.log(`Found ${uniqueUsers.length} unique valid tokens in this batch`);
  
        const messages = uniqueUsers.map(user => ({
          to: user.expoPushToken,
          sound: 'default',
          title: title,
          body: body,
          data: { noticeTitle: title },
        }));
  
        const chunks = expo.chunkPushNotifications(messages);
        const tickets = [];
  
        const sendPromises = chunks.map(async (chunk, index) => {
          await new Promise(resolve => setTimeout(resolve, index * 100)); // Stagger requests
          try {
            const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
            console.log(`Sent chunk ${index + 1}/${chunks.length} with ${ticketChunk.length} notifications`);
            return ticketChunk;
          } catch (error) {
            console.error(`Error sending chunk ${index + 1}:`, error.message);
            return [];
          }
        });
  
        const chunkTickets = await Promise.all(sendPromises);
        tickets.push(...chunkTickets.flat());
  
        // Handle receipts
        const receiptIds = tickets.filter(ticket => ticket.id).map(ticket => ticket.id);
        if (receiptIds.length) {
          try {
            const receipts = await expo.getPushNotificationReceiptsAsync(receiptIds);
            console.log('Notification receipts:', receipts);
  
            Object.entries(receipts).forEach(([receiptId, receipt]) => {
              if (receipt.status === 'error') {
                console.warn(`Notification failed for receipt ${receiptId}: ${receipt.message}`);
                if (receipt.details?.error === 'DeviceNotRegistered') {
                  const tokenToRemove = messages.find(msg => msg.to === receiptId)?.to;
                  if (tokenToRemove) {
                    User.updateOne(
                      { expoPushToken: tokenToRemove },
                      { $unset: { expoPushToken: 1 } }
                    )
                      .then(() => console.log(`Removed invalid token for receipt ${receiptId}`))
                      .catch(err => console.error(`Error removing token: ${err.message}`));
                  }
                }
              } else {
                console.log(`Notification succeeded for receipt ${receiptId}`);
              }
            });
          } catch (error) {
            console.error('Error fetching receipts:', error.message);
          }
        }
  
        skip += batchSize;
      }
  
      console.log(`Push notification process completed. Total unique notifications sent: ${processedTokens.size}`);
    } catch (error) {
      console.error('Error in sendPushNotifications:', error.message);
    }
  }
  /**
   * Scrapes notices from the IGIT Sarang notice page and only includes new notices based on ID.
   */
  async function scrapeNotices() {
    try {
      const { data } = await axios.get(NOTICE_URL, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      });
  
      const $ = load(data);
      const noticePromises = [];
  
      $("#table_notice tbody tr").each((index, element) => {
        const $row = $(element);
        const id = $row.attr("id")?.replace("noticerow_", "") || null;
        const title = $row.find("td").eq(0).text().trim().replace(/\s+/g, " ");
        const dateStr = $row.find("td").eq(1).text().trim();
        const pdfLink = $row.find("td").eq(2).find("a").attr("href") || null;
        const isNew = $row.find("td").eq(0).find('img[src*="new.gif"]').length > 0;
  
        let formattedDate;
        try {
          const [day, month, year] = dateStr.split("-").map(Number);
          formattedDate = new Date(year, month - 1, day );
          if (isNaN(formattedDate.getTime())) {
            throw new Error("Invalid date");
          }
        } catch (error) {
          formattedDate = null;
          console.warn(`Failed to parse date: ${dateStr}`);
        }
  
        noticePromises.push(
          (async () => {
            if (!id) {
              console.warn(`No ID found for notice: ${title}, skipping`);
              return null;
            }
  
            const existingNotice = await Notice.findOne({ id });
            if (!existingNotice) {
              return { id, title, date: formattedDate, pdfLink, isNew };
            }
            console.log(`Notice with ID ${id} already exists in DB, skipping: ${title}`);
            return null;
          })()
        );
      });
  
      const notices = (await Promise.all(noticePromises)).filter((notice) => notice !== null);
      return notices;
    } catch (error) {
      console.error("Error scraping notices:", error.message);
      return [];
    }
  }
      
  /**
   * Scrapes notices, saves new ones to the database, and sends push notifications.
   */
  const createNoticeFromScraping = async () => {
    const scrapedNotices = await scrapeNotices();
  
    if (!scrapedNotices.length) {
      console.log("No new notices scraped");
      return;
    }
  
    for (const scrapedNotice of scrapedNotices) {
      const { id, title, date, pdfLink, isNew } = scrapedNotice;
  
      try {
        const newNotice = await Notice.create({
          id,
          title,
          pdfLink,
          date: date ? new Date(date) : new Date(),
          isNew: isNew || false,
        });
        console.log(`New notice saved with ID ${id}: ${title}`);
  
        // Send push notification for the new notice
        await sendPushNotifications(
          "New Notice",
          `A new notice has been posted: ${title}`
        );
      } catch (error) {
        console.error(`Error saving notice with ID ${id}: ${title} -`, error.message);
      }
    }
  };



// Manually define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
    
    host: 'smtp.gmail.com', // Use your SMTP server
    port: 587, // Usually 587 for secure connections
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Send Modern HTML Email Notification
const sendEmail = async (to, subject, template, data) => {
    try {
        const emailTemplate = await ejs.renderFile(
            path.join(__dirname, "../templates", `${template}.ejs`), // Now __dirname works
            data
        );

        await transporter.sendMail({
            from: `IGIT(MCA) <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html: emailTemplate,
        });

        console.log(`✅ Email sent to ${to}`);
    } catch (error) {
        console.error("❌ Error sending email:", error);
    }
};

// Send Professional SMS Notification
const sendSMS = async (to, message) => {
    try {
        await twilioClient.messages.create({
            body: `🚀 ${message} \n - Your Company`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to,
        });
        console.log(`✅ SMS sent to ${to}`);
    } catch (error) {
        console.error("❌ Error sending SMS:", error);
    }
};

export { sendEmail, sendSMS,sendPushNotifications };
