const { transport } = require('../lib/mailer');
const env = process.env.SERVER == 'local' ? require('../config/env.local.js') : require('../config/env.js');


module.exports = class Mailer {

    // set email to driver about settlement payment
    static sendDriverPaymentDoneEmail(dirverId, settlementId) {
        // get driver email, 
        var email = '';

        // get user email data as sender email credentials

        var subject = 'Settlement Payment Confirmation';
        var html = `<h2> Your ${settlementId} settlement paid successfully! </h2>`;
        var attachedFile = undefined;

        // send email
        Mailer.sendMail(email, subject, html, attachedFile);
    }

    // !!!! need correction for user credentials
    static async sendMail(toEmail, subject, html, attachedFile, replyTo) {

        let mailOptions = {
            from:`${env.mailer.email}`,
            to: [toEmail],
            subject: subject,
            replyTo
        };

        if (html) {
            mailOptions.text = html;
        }

        if (attachedFile) {
            mailOptions.attachments = [
                {
                    filename: attachedFile
                }
            ];
        }
        // if (replyTo) {
        //     mailOptions.replyTo = fromEmail;
        // }
        transport.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            }
            console.log(info.messageId);
            return info;
        });
    }

    static async sendEmailToUs(to, subject, html, replyTo) {
        const sendmail = require('sendmail')();
        sendmail({
            from: 'noreply@getflatbeds.com',
            to: to,
            subject: subject,
            html: html,
            replyTo: replyTo
        }, function (err, reply) {
            console.log(err && err.stack);
            console.dir(reply);
        });
    }

}; // End of Class