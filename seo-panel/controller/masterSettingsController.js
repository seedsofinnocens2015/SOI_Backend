const { HrMasterSetting, HrCompany } = require('../model/MasterSettings');

const DEFAULT_OFFER_LETTER = `<p style="text-align:right">Date: {{date}}<br>Ref: {{ref_no}}</p>
<p><b>To,</b><br>{{candidate_name}}<br>Mobile: {{mobile}} | Email: {{email}}</p>
<h3 style="text-align:center;text-decoration:underline">OFFER OF EMPLOYMENT</h3>
<p>Dear {{candidate_name}},</p>
<p>We are pleased to offer you the position of <b>{{designation}}</b> in the <b>{{department}}</b> department at our <b>{{centre}}</b> centre of <b>{{company_name}}</b>, on the following terms:</p>
<ol>
<li><b>Compensation:</b> Your annual cost to company (CTC) will be Rs. {{ctc_annual}} ({{ctc_words}}).</li>
<li><b>Date of joining:</b> You are expected to join on {{joining_date}}.</li>
<li><b>Reporting to:</b> {{reporting_manager}}</li>
<li><b>Probation:</b> You will be on probation for {{probation_months}} months from the date of joining.</li>
<li><b>Verification:</b> This offer is subject to satisfactory verification of your documents and references.</li>
</ol>
<p>This offer is valid till {{offer_valid_till}}. Please sign and return a copy of this letter as your acceptance.</p>
<p>We welcome you to {{company_name}} and look forward to a long and successful association.</p>
<p>Yours sincerely,<br>{{signature}}<br><b>{{hr_signatory}}</b><br>{{hr_signatory_title}}<br>{{company_name}}</p>
<p style="margin-top:30px">I accept the above offer.<br><br>Signature: ___________________________ &nbsp;&nbsp;&nbsp;&nbsp; Date: ____________</p>`;

const DEFAULT_APPOINTMENT_LETTER = `<p style="text-align:right">Date: {{date}}<br>Ref: {{ref_no}}</p>
<p><b>To,</b><br>{{candidate_name}}<br>Address: {{candidate_address}}<br>Mobile: {{mobile}} | Email: {{email}}</p>
<h3 style="text-align:center;text-decoration:underline">LETTER OF APPOINTMENT</h3>
<p>Dear {{candidate_name}},</p>
<p>With reference to your acceptance of our offer letter dated {{offer_date}}, we are pleased to confirm your appointment as <b>{{designation}}</b> in the <b>{{department}}</b> department at <b>{{company_name}}</b> ({{centre}} Centre), effective from your date of joining <b>{{joining_date}}</b>.</p>
<ol>
<li><b>Employee ID:</b> Your allotted Employee ID is <b>{{employee_id}}</b>.</li>
<li><b>Emoluments:</b> Your detailed salary breakup and compensation structure is outlined in Annexure-A attached herewith.</li>
<li><b>Probation Period:</b> You will be on probation for a period of {{probation_months}} months, extendable at the discretion of the management.</li>
<li><b>Notice Period:</b> During probation, the notice period for either party shall be {{probation_notice_days}} days, and post-confirmation {{notice_days}} days.</li>
<li><b>Code of Conduct & Confidentiality:</b> You agree to abide by all the service rules, patient confidentiality policies, and professional ethics of {{company_name}}.</li>
</ol>
<p>We congratulate you on your appointment and wish you a rewarding career with Seeds of Innocence.</p>
<p>Yours sincerely,<br>{{signature}}<br><b>{{hr_signatory}}</b><br>{{hr_signatory_title}}<br>{{company_name}}</p>
<p style="margin-top:30px"><b>Employee Acknowledgment:</b><br>I have read, understood, and accept the terms and conditions outlined above.<br><br>Signature: ___________________________ &nbsp;&nbsp;&nbsp;&nbsp; Date: ____________</p>`;

// Get Master Settings (Purely dynamic from DB, no hardcoded dummy items)
async function getMasterSettings(req, res) {
  try {
    let settings = await HrMasterSetting.findOne();
    if (!settings) {
      settings = await HrMasterSetting.create({
        dropdowns: {},
        offerLetterTemplate: DEFAULT_OFFER_LETTER,
        appointmentLetterTemplate: DEFAULT_APPOINTMENT_LETTER,
        probationMonths: 6,
        vacancyClosureDays: 30,
        autoLogoutMinutes: 30,
        requisitionIdPrefix: 'REQ-',
        candidateIdPrefix: 'CAN-',
      });
    }

    const dropdownsObj = {};
    if (settings.dropdowns) {
      if (typeof settings.dropdowns.get === 'function') {
        for (const [key, val] of settings.dropdowns.entries()) {
          dropdownsObj[key] = Array.isArray(val) ? val : [];
        }
      } else {
        Object.keys(settings.dropdowns).forEach((k) => {
          dropdownsObj[k] = Array.isArray(settings.dropdowns[k]) ? settings.dropdowns[k] : [];
        });
      }
    }

    return res.json({
      ok: true,
      data: {
        dropdowns: dropdownsObj,
        offerLetterTemplate: settings.offerLetterTemplate || DEFAULT_OFFER_LETTER,
        appointmentLetterTemplate: settings.appointmentLetterTemplate || DEFAULT_APPOINTMENT_LETTER,
        probationMonths: settings.probationMonths ?? 6,
        vacancyClosureDays: settings.vacancyClosureDays ?? 30,
        autoLogoutMinutes: settings.autoLogoutMinutes ?? 30,
        requisitionIdPrefix: settings.requisitionIdPrefix || 'REQ-',
        candidateIdPrefix: settings.candidateIdPrefix || 'CAN-',
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// Update Dropdown List for a specific key
async function updateDropdownList(req, res) {
  try {
    const { key, items } = req.body;
    if (!key || !Array.isArray(items)) {
      return res.status(400).json({ ok: false, error: 'Key and items array are required.' });
    }

    let settings = await HrMasterSetting.findOne();
    if (!settings) {
      settings = new HrMasterSetting({ dropdowns: {} });
    }

    if (!settings.dropdowns) {
      settings.dropdowns = new Map();
    }

    if (typeof settings.dropdowns.set === 'function') {
      settings.dropdowns.set(key, items);
    } else {
      settings.dropdowns[key] = items;
      settings.markModified('dropdowns');
    }

    await settings.save();
    return res.json({ ok: true, message: `Dropdown ${key} updated successfully.`, data: items });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// Update Letter Template (offer or appointment)
async function updateLetterTemplate(req, res) {
  try {
    const { type, template } = req.body;
    if (!type || template === undefined) {
      return res.status(400).json({ ok: false, error: 'type and template are required.' });
    }

    let settings = await HrMasterSetting.findOne();
    if (!settings) settings = new HrMasterSetting();

    if (type === 'offer') {
      settings.offerLetterTemplate = template;
    } else if (type === 'appointment') {
      settings.appointmentLetterTemplate = template;
    } else {
      return res.status(400).json({ ok: false, error: 'Invalid template type.' });
    }

    await settings.save();
    return res.json({ ok: true, message: `${type} template saved successfully.` });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// Update General Settings
async function updateGeneralSettings(req, res) {
  try {
    const {
      probationMonths,
      vacancyClosureDays,
      autoLogoutMinutes,
      requisitionIdPrefix,
      candidateIdPrefix,
    } = req.body;

    let settings = await HrMasterSetting.findOne();
    if (!settings) settings = new HrMasterSetting();

    if (probationMonths !== undefined) settings.probationMonths = Number(probationMonths);
    if (vacancyClosureDays !== undefined) settings.vacancyClosureDays = Number(vacancyClosureDays);
    if (autoLogoutMinutes !== undefined) settings.autoLogoutMinutes = Number(autoLogoutMinutes);
    if (requisitionIdPrefix !== undefined) settings.requisitionIdPrefix = String(requisitionIdPrefix).trim();
    if (candidateIdPrefix !== undefined) settings.candidateIdPrefix = String(candidateIdPrefix).trim();

    await settings.save();
    return res.json({ ok: true, message: 'General settings updated successfully.', data: settings });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// Reset Template to default
async function resetTemplate(req, res) {
  try {
    const { type } = req.body;
    let settings = await HrMasterSetting.findOne();
    if (!settings) settings = new HrMasterSetting();

    let def = '';
    if (type === 'offer') {
      def = DEFAULT_OFFER_LETTER;
      settings.offerLetterTemplate = def;
    } else if (type === 'appointment') {
      def = DEFAULT_APPOINTMENT_LETTER;
      settings.appointmentLetterTemplate = def;
    }

    await settings.save();
    return res.json({ ok: true, message: 'Reset to default successfully.', template: def });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// Companies & Letterheads (Clean, no dummy seeding)
async function getCompanies(req, res) {
  try {
    const companies = await HrCompany.find().sort({ createdAt: -1 });
    return res.json({ ok: true, data: companies || [] });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

async function createCompany(req, res) {
  try {
    const comp = await HrCompany.create(req.body);
    return res.status(201).json({ ok: true, data: comp });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

async function updateCompany(req, res) {
  try {
    const { id } = req.params;
    const comp = await HrCompany.findByIdAndUpdate(id, req.body, { new: true });
    if (!comp) return res.status(404).json({ ok: false, error: 'Company not found' });
    return res.json({ ok: true, data: comp });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

async function deleteCompany(req, res) {
  try {
    const { id } = req.params;
    await HrCompany.findByIdAndDelete(id);
    return res.json({ ok: true, message: 'Company deleted successfully' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

// Add/Update Signatory for a company
async function saveSignatory(req, res) {
  try {
    const { companyId } = req.params;
    const { signatoryId, name, designation, signatureImage, isDefault, active } = req.body;

    const company = await HrCompany.findById(companyId);
    if (!company) return res.status(404).json({ ok: false, error: 'Company not found' });

    if (isDefault) {
      company.signatories.forEach((s) => {
        s.isDefault = false;
      });
    }

    if (signatoryId) {
      const sig = company.signatories.id(signatoryId);
      if (sig) {
        if (name !== undefined) sig.name = name;
        if (designation !== undefined) sig.designation = designation;
        if (signatureImage !== undefined) sig.signatureImage = signatureImage;
        if (isDefault !== undefined) sig.isDefault = isDefault;
        if (active !== undefined) sig.active = active;
      }
    } else {
      company.signatories.push({
        name: name || '',
        designation: designation || '',
        signatureImage: signatureImage || '',
        isDefault: Boolean(isDefault),
        active: active !== undefined ? active : true,
      });
    }

    await company.save();
    return res.json({ ok: true, data: company });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

async function deleteSignatory(req, res) {
  try {
    const { companyId, signatoryId } = req.params;
    const company = await HrCompany.findById(companyId);
    if (!company) return res.status(404).json({ ok: false, error: 'Company not found' });

    company.signatories.pull({ _id: signatoryId });
    await company.save();
    return res.json({ ok: true, data: company });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

module.exports = {
  getMasterSettings,
  updateDropdownList,
  updateLetterTemplate,
  updateGeneralSettings,
  resetTemplate,
  getCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  saveSignatory,
  deleteSignatory,
  DEFAULT_OFFER_LETTER,
  DEFAULT_APPOINTMENT_LETTER,
};
