const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

/**
 * Генерирует PDF счета и возвращает Buffer.
 * @param {object} invoice - данные счета (invoice_number, amount, total_amount, discount_percent, issue_date, due_date, payment_qr_data, ...)
 * @param {object} client - данные клиента (company_name, contact_person, phone, email)
 * @param {object} company - реквизиты компании (company_name, legal_address, tax_id, bank_account, bank_name, phone, email)
 * @param {object} order - данные заказа (order_number, product_name, quantity, unit_price) — опционально
 */
async function generateInvoicePdf(invoice, client, company, order) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Заголовок
      doc
        .fillColor('#0F1F3D')
        .fontSize(22)
        .text(company?.company_name || 'StitchFlow', 50, 50)
        .fontSize(10)
        .fillColor('#666')
        .text('Контроль каждого стежка', 50, 78);

      doc
        .fillColor('#D4AF37')
        .fontSize(18)
        .text(`СЧЕТ № ${invoice.invoice_number}`, 50, 110);

      // Реквизиты компании
      let y = 140;
      doc.fillColor('#333').fontSize(9);
      if (company) {
        doc.text(`Адрес: ${company.legal_address || '-'}`, 50, y);
        y += 14;
        doc.text(`ИНН: ${company.tax_id || '-'}`, 50, y);
        y += 14;
        doc.text(`Р/с: ${company.bank_account || '-'} (${company.bank_name || '-'})`, 50, y);
        y += 14;
        doc.text(`Тел: ${company.phone || '-'} | Email: ${company.email || '-'}`, 50, y);
        y += 24;
      }

      // Клиент
      doc.fontSize(11).fillColor('#0F1F3D').text('Плательщик:', 50, y);
      y += 16;
      doc.fontSize(10).fillColor('#333');
      doc.text(`${client?.company_name || '-'}`, 50, y);
      y += 14;
      if (client?.contact_person) {
        doc.text(`Контакт: ${client.contact_person}`, 50, y);
        y += 14;
      }
      if (client?.phone) {
        doc.text(`Тел: ${client.phone}`, 50, y);
        y += 14;
      }

      y += 10;
      doc.text(`Дата выставления: ${new Date(invoice.issue_date).toLocaleDateString('ru-RU')}`, 50, y);
      if (invoice.due_date) {
        doc.text(`Срок оплаты: ${new Date(invoice.due_date).toLocaleDateString('ru-RU')}`, 300, y);
      }
      y += 30;

      // Таблица товаров
      doc.rect(50, y, 495, 24).fill('#0F1F3D');
      doc.fillColor('#fff').fontSize(10);
      doc.text('Товар / услуга', 60, y + 7);
      doc.text('Кол-во', 320, y + 7);
      doc.text('Цена', 400, y + 7);
      doc.text('Сумма', 470, y + 7);
      y += 24;

      doc.fillColor('#333').fontSize(10);
      const productName = order?.product_name || 'Услуги швейного производства';
      const quantity = order?.quantity || 1;
      const unitPrice = order?.unit_price || invoice.amount;

      doc.rect(50, y, 495, 24).strokeColor('#eee').stroke();
      doc.text(productName, 60, y + 7, { width: 250 });
      doc.text(String(quantity), 320, y + 7);
      doc.text(`$${Number(unitPrice).toLocaleString()}`, 400, y + 7);
      doc.text(`$${Number(invoice.amount).toLocaleString()}`, 470, y + 7);
      y += 40;

      // Итоги
      doc.fontSize(10);
      doc.text('Сумма:', 380, y);
      doc.text(`$${Number(invoice.amount).toLocaleString()}`, 470, y);
      y += 18;

      if (Number(invoice.discount_percent) > 0) {
        doc.text(`Скидка (${invoice.discount_percent}%):`, 380, y);
        doc.text(`-$${(Number(invoice.amount) * Number(invoice.discount_percent) / 100).toLocaleString()}`, 470, y);
        y += 18;
      }

      doc.fontSize(13).fillColor('#0F1F3D');
      doc.text('Итого к оплате:', 380, y);
      doc.text(`$${Number(invoice.total_amount).toLocaleString()}`, 470, y);
      y += 40;

      // QR-код
      if (invoice.payment_qr_data) {
        const qrDataUrl = await QRCode.toDataURL(invoice.payment_qr_data, { width: 120 });
        const qrBase64 = qrDataUrl.split(',')[1];
        const qrBuffer = Buffer.from(qrBase64, 'base64');
        doc.image(qrBuffer, 50, y, { width: 100 });
        doc.fontSize(8).fillColor('#999').text('QR-код для оплаты', 50, y + 105);
      }

      // Статус
      doc.fontSize(10).fillColor(invoice.status === 'paid' ? '#16a34a' : '#ca8a04');
      const statusLabel = invoice.status === 'paid' ? 'ОПЛАЧЕНО' : invoice.status === 'overdue' ? 'ПРОСРОЧЕН' : 'НЕ ОПЛАЧЕНО';
      doc.text(`Статус: ${statusLabel}`, 380, y + 40);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePdf };
