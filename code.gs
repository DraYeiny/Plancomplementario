// ══════════════════════════════════════════════════════════════
//  GASTROPEDIA — Google Apps Script para Planes de Alimentación
//  Hoja destino: "PLAN ALIMENTARIO"
//  Hoja de sesión: "LOCAL"
//
//  CONFIGURACIÓN (una sola vez):
//  1. En Google Sheets: Extensiones → Apps Script
//  2. Borra el código existente y pega todo este archivo
//  3. Guardar (Ctrl+S)
//  4. Implementar → Nueva implementación
//     · Tipo: Aplicación web
//     · Ejecutar como: Yo
//     · Quién tiene acceso: Cualquier persona
//  5. Autorizar y copiar la URL que aparece → pégala en la página
// ══════════════════════════════════════════════════════════════

const SHEET_NAME = 'PLAN ALIMENTARIO';
const LOCAL_SHEET_NAME = 'LOCAL';
const DRIVE_FOLDER_ID = '1caarX5gJ1rGWItU7lH0w9MsdeVp5wXEF';

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 4).setValues([['ID', 'Nombre del plan', 'Fecha guardado', 'Datos']]);
    sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#c8e6c9').setFontColor('#1b5e20');
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 220);
    sheet.setColumnWidth(3, 180);
    sheet.setColumnWidth(4, 600);
  }
  return sheet;
}

function getLocalSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOCAL_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOCAL_SHEET_NAME);
    sheet.getRange(1, 1, 1, 2).setValues([['Timestamp', 'Datos']]);
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#fff9c4').setFontColor('#713f12');
    sheet.setColumnWidth(1, 200);
    sheet.setColumnWidth(2, 800);
  }
  return sheet;
}

function doGet(e) {
  try {
    const action = e.parameter && e.parameter.action;

    if (action === 'getDriveLink') {
      const reqId = e.parameter.reqId || '';
      const props = PropertiesService.getScriptProperties();
      const link = props.getProperty('drivelink_' + reqId);
      if (link) {
        props.deleteProperty('drivelink_' + reqId);
        return output({ ok: true, link });
      }
      return output({ ok: false });
    }

    if (action === 'getLocal') {
      const ls = getLocalSheet();
      if (ls.getLastRow() >= 2) {
        const row = ls.getRange(2, 1, 1, 2).getValues()[0];
        if (row[0] && row[1]) {
          try {
            return output({ ok: true, timestamp: String(row[0]), data: JSON.parse(row[1]) });
          } catch(err) {}
        }
      }
      return output({ ok: true, data: null });
    }

    const sheet = getSheet();
    const last = sheet.getLastRow();
    const plans = [];
    if (last >= 2) {
      const rows = sheet.getRange(2, 1, last - 1, 4).getValues();
      rows.forEach(r => {
        if (r[0]) {
          try { plans.push({ id: String(r[0]), name: r[1], created: String(r[2]), data: JSON.parse(r[3]) }); }
          catch (err) {}
        }
      });
    }
    return output({ ok: true, plans });
  } catch (err) {
    return output({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const sheet = getSheet();

    if (body.action === 'saveToDrive') {
      try {
        const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
        const bytes = Utilities.base64Decode(body.pdf);
        const blob = Utilities.newBlob(bytes, 'application/pdf', body.filename || 'Plan_Alimentario.pdf');
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        const link = 'https://drive.google.com/file/d/' + file.getId() + '/view?usp=sharing';
        PropertiesService.getScriptProperties().setProperty('drivelink_' + body.reqId, link);
        return output({ ok: true });
      } catch(err) {
        return output({ ok: false, error: err.message });
      }
    }

    if (body.action === 'saveLocal') {
      const ls = getLocalSheet();
      const ts = body.timestamp || new Date().toISOString();
      const vals = [[ts, JSON.stringify(body.data)]];
      if (ls.getLastRow() >= 2) {
        ls.getRange(2, 1, 1, 2).setValues(vals);
      } else {
        ls.appendRow(vals[0]);
      }
      return output({ ok: true });
    }

    if (body.action === 'save') {
      const p = body.plan;
      const last = sheet.getLastRow();
      let targetRow = -1;
      if (last >= 2) {
        const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(p.id)) { targetRow = i + 2; break; }
        }
      }
      const vals = [[p.id, p.name, p.created || new Date().toISOString(), JSON.stringify(p.data)]];
      if (targetRow > 0) sheet.getRange(targetRow, 1, 1, 4).setValues(vals);
      else { sheet.appendRow(vals[0]); }
      return output({ ok: true });
    }

    if (body.action === 'delete') {
      const last = sheet.getLastRow();
      if (last >= 2) {
        const ids = sheet.getRange(2, 1, last - 1, 1).getValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(body.id)) {
            sheet.deleteRow(i + 2);
            return output({ ok: true });
          }
        }
      }
      return output({ ok: false, error: 'Plan no encontrado' });
    }

    return output({ ok: false, error: 'Acción desconocida' });
  } catch (err) {
    return output({ ok: false, error: err.message });
  }
}

function output(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
