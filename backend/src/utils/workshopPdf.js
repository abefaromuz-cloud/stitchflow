const PDFDocument = require('pdfkit');

// Маршрутный лист для пачки (идёт с пачкой в цех)
async function generateRouteSheet(bundle, operations, company) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A5', margin: 30 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Шапка
      doc.rect(30, 30, doc.page.width - 60, 50).fill('#0F1F3D');
      doc.fillColor('#D4AF37').fontSize(14).font('Helvetica-Bold')
        .text(company?.company_name || 'StitchFlow', 40, 38);
      doc.fillColor('#FFFFFF').fontSize(10)
        .text('МАРШРУТНЫЙ ЛИСТ', 40, 56);

      // Информация о пачке
      doc.fillColor('#0F1F3D').fontSize(12).font('Helvetica-Bold')
        .text(`Пачка: ${bundle.bundle_number}`, 30, 95);
      doc.fontSize(10).font('Helvetica')
        .fillColor('#333333')
        .text(`Изделие: ${bundle.product_name}`, 30, 112)
        .text(`Размер: ${bundle.size || '—'}`, 30, 126)
        .text(`Цвет: ${bundle.color || '—'}`, 30, 140)
        .text(`Количество: ${bundle.quantity} шт`, 30, 154)
        .text(`Заказ: ${bundle.order_number ? '№' + bundle.order_number : '—'}`, 30, 168);

      // Линия
      doc.moveTo(30, 182).lineTo(doc.page.width - 30, 182).stroke('#0F1F3D');

      // Операции
      doc.fillColor('#0F1F3D').fontSize(11).font('Helvetica-Bold')
        .text('Операции пошива:', 30, 190);

      let y = 208;
      operations.forEach((op, i) => {
        if (y > doc.page.height - 60) { doc.addPage(); y = 30; }

        // Чередующийся фон
        if (i % 2 === 0) {
          doc.rect(30, y - 2, doc.page.width - 60, 18).fill('#F8FAFC');
        }

        doc.fillColor('#0F1F3D').fontSize(9).font('Helvetica-Bold')
          .text(`${op.operation_number}.`, 30, y, { width: 25 });
        doc.font('Helvetica')
          .text(op.operation_name, 58, y, { width: 200 });

        // Поле для подписи швеи
        const sigX = doc.page.width - 120;
        doc.rect(sigX, y - 2, 85, 16).stroke('#CBD5E1');
        doc.fillColor('#94A3B8').fontSize(7)
          .text(op.employee_name || 'Подпись / ФИО', sigX + 3, y + 2, { width: 79 });

        y += 20;
      });

      // Итого внизу
      const bottomY = doc.page.height - 55;
      doc.moveTo(30, bottomY).lineTo(doc.page.width - 30, bottomY).stroke('#CBD5E1');
      doc.fillColor('#333333').fontSize(8).font('Helvetica')
        .text(`Дата: ____________`, 30, bottomY + 8)
        .text(`Принял: ____________`, 140, bottomY + 8)
        .text(`Сдал: ____________`, 270, bottomY + 8);
      doc.fillColor('#94A3B8').fontSize(7)
        .text(`StitchFlow · ${new Date().toLocaleDateString('ru-RU')}`, 30, bottomY + 24);

      doc.end();
    } catch (err) { reject(err); }
  });
}

// Акт рекламации по пачке
async function generateBundleReclamation(bundle, reclamations, operations, company) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A5', margin: 30 });
      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Шапка
      doc.rect(30, 30, doc.page.width - 60, 50).fill('#DC2626');
      doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold')
        .text('АКТ РЕКЛАМАЦИИ', 40, 38);
      doc.fontSize(9).font('Helvetica')
        .text(company?.company_name || 'StitchFlow', 40, 56);

      // Пачка
      doc.fillColor('#0F1F3D').fontSize(11).font('Helvetica-Bold')
        .text(`Пачка: ${bundle.bundle_number}  ·  ${bundle.product_name}`, 30, 95);
      doc.fontSize(9).font('Helvetica').fillColor('#333333')
        .text(`Размер: ${bundle.size||'—'}  ·  Цвет: ${bundle.color||'—'}  ·  Кол-во: ${bundle.quantity} шт`, 30, 110)
        .text(`Дата: ${new Date().toLocaleDateString('ru-RU')}  ·  Заказ: ${bundle.order_number||'—'}`, 30, 124);

      doc.moveTo(30, 138).lineTo(doc.page.width - 30, 138).stroke('#DC2626');

      // Рекламации
      doc.fillColor('#DC2626').fontSize(11).font('Helvetica-Bold').text('Выявленные дефекты:', 30, 146);
      let y = 162;
      reclamations.forEach((r, i) => {
        if (y > doc.page.height - 80) { doc.addPage(); y = 30; }
        doc.fillColor('#0F1F3D').fontSize(10).font('Helvetica-Bold').text(`${i+1}. ${r.description}`, 30, y);
        y += 14;
        doc.fillColor('#64748B').fontSize(8).font('Helvetica')
          .text(`   Тип: ${r.defect_type||'—'}  ·  Кол-во: ${r.quantity} шт  ·  Сотрудник: ${r.employee_name||'—'}`, 30, y);
        y += 18;
      });

      // Операции (для исправления)
      if (operations?.length > 0) {
        y += 6;
        doc.moveTo(30, y).lineTo(doc.page.width - 30, y).stroke('#CBD5E1');
        y += 10;
        doc.fillColor('#0F1F3D').fontSize(10).font('Helvetica-Bold').text('Операции для исправления:', 30, y);
        y += 14;
        operations.forEach(op => {
          if (y > doc.page.height - 50) { doc.addPage(); y = 30; }
          doc.fillColor('#333333').fontSize(8).font('Helvetica')
            .text(`${op.operation_number}. ${op.operation_name}`, 30, y, { width: 250 });
          // Чекбокс
          doc.rect(doc.page.width - 45, y - 1, 12, 12).stroke('#0F1F3D');
          y += 16;
        });
      }

      // Подписи
      const bottomY = doc.page.height - 55;
      doc.moveTo(30, bottomY).lineTo(doc.page.width - 30, bottomY).stroke('#CBD5E1');
      doc.fillColor('#333333').fontSize(8).font('Helvetica')
        .text('Мастер: ________________________', 30, bottomY + 8)
        .text('Швея: ________________________', 30, bottomY + 22);

      doc.end();
    } catch (err) { reject(err); }
  });
}

module.exports = { generateRouteSheet, generateBundleReclamation };
