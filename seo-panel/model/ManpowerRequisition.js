const mongoose = require('mongoose');

const { Schema } = mongoose;

const DEPARTMENTS = [
  'Accounts & Finance',
  'Admin & Operations',
  'Billing',
  'Business Development',
  'Call Center',
  'Clinical Operations',
  'Digital Marketing',
  'Embryology',
  'Facility & Maintenance',
  'Field Operations',
  'Human Resources',
  'IT',
  'IVF',
  'Lab Operations',
  'Management',
  'Molecular Biology',
  'Nursing',
  'OT Operations',
  'Pathology',
  'Patient Coordination',
  'Pharmacy',
  'Purchase & Procurement',
  'Quality & Compliances',
  'Sales & Marketing',
];

const DEPARTMENT_DESIGNATIONS = {
  'Human Resources': ['HR Executive', 'HR Manager', 'Recruiter', 'HR Generalist', 'Talent Acquisition Lead'],
  'Accounts & Finance': ['Accountant', 'Senior Accountant', 'Finance Manager', 'Accounts Executive', 'Billing Officer'],
  'Admin & Operations': ['Operations Manager', 'Center Coordinator', 'Admin Executive', 'Front Desk Executive', 'Facility Manager'],
  'Billing': ['Billing Executive', 'Billing In-charge', 'Cashier', 'Billing Assistant'],
  'Business Development': ['BD Executive', 'BD Manager', 'Corporate Relations Officer'],
  'Call Center': ['Telecaller', 'Customer Support Executive', 'Team Lead - Telecalling', 'Quality Analyst'],
  'Clinical Operations': ['Clinical Coordinator', 'Clinic Incharge', 'Counselor'],
  'Digital Marketing': ['SEO Specialist', 'Performance Marketer', 'Content Writer', 'Graphic Designer', 'Social Media Manager'],
  'Embryology': ['Junior Embryologist', 'Senior Embryologist', 'Lab Director', 'Embryology Trainee'],
  'Facility & Maintenance': ['Maintenance Supervisor', 'Electrician', 'Facility In-charge'],
  'Field Operations': ['Field Executive', 'Area Manager', 'Liaison Officer'],
  'IT': ['Software Engineer', 'Full Stack Developer', 'System Administrator', 'IT Support Executive'],
  'IVF': ['IVF Consultant', 'Fertility Specialist', 'Senior Consultant', 'Fellow - Reproductive Medicine'],
  'Lab Operations': ['Lab Technician', 'Lab Incharge', 'Senior Lab Tech', 'Phlebotomist'],
  'Management': ['General Manager', 'Assistant General Manager', 'Director Operations', 'Zonal Head'],
  'Molecular Biology': ['Molecular Biologist', 'Genetic Counselor', 'Research Associate'],
  'Nursing': ['Staff Nurse', 'Nursing Supervisor', 'OT Nurse', 'Ward Sister', 'Nurse In-charge'],
  'OT Operations': ['OT Technician', 'OT Incharge', 'Anesthesia Technician'],
  'Pathology': ['Pathologist', 'Senior Pathologist', 'Histotechnician'],
  'Patient Coordination': ['Patient Care Executive', 'Patient Counselor', 'Floor Coordinator'],
  'Pharmacy': ['Pharmacist', 'Senior Pharmacist', 'Pharmacy Manager', 'Pharmacy Assistant'],
  'Purchase & Procurement': ['Purchase Executive', 'Procurement Manager', 'Store Keeper'],
  'Quality & Compliances': ['Quality Manager', 'NABH Coordinator', 'Compliance Officer'],
  'Sales & Marketing': ['Marketing Executive', 'Area Sales Manager', 'Territory Manager', 'Medical Representative'],
};

const manpowerRequisitionSchema = new Schema(
  {
    reqId: { type: String, unique: true, index: true }, // e.g. REQ-0001
    company: { type: String, required: true, default: 'Seeds of Innocence', trim: true },
    dateRaised: { type: Date, required: true, default: Date.now },
    centre: { type: String, required: true, trim: true },
    department: { type: String, required: true, trim: true },
    designation: { type: String, required: true, trim: true },
    hiringType: {
      type: String,
      enum: ['New Vacancy', 'Replacement', 'Budgeted', 'Urgent', ''],
      default: 'New Vacancy',
    },
    positionsRequired: { type: Number, required: true, min: 1, default: 1 },
    priority: {
      type: String,
      enum: ['High', 'Medium', 'Low', 'Critical', ''],
      default: 'Medium',
    },
    requestedBy: { type: String, trim: true, default: '' },
    approvalStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'On Hold'],
      default: 'Pending',
      index: true,
    },
    approvalDate: { type: Date, default: null },
    recruiterAssigned: { type: String, trim: true, default: '' },
    targetClosure: { type: Date, default: null },
    filled: { type: Number, default: 0, min: 0 },
    open: { type: Number, default: 1, min: 0 },
    requisitionStatus: {
      type: String,
      enum: ['Open', 'In Progress', 'Closed', 'Cancelled', 'On Hold'],
      default: 'Open',
      index: true,
    },
    remarks: { type: String, trim: true, default: '' },
    createdBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

// Auto generate reqId if not present
manpowerRequisitionSchema.pre('validate', async function (next) {
  if (this.reqId) return next();
  try {
    const lastDoc = await this.constructor.findOne({}, { reqId: 1 }).sort({ createdAt: -1 }).lean();
    let nextNum = 1;
    if (lastDoc && lastDoc.reqId) {
      const match = lastDoc.reqId.match(/REQ-(\d+)/);
      if (match && match[1]) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    this.reqId = `REQ-${String(nextNum).padStart(4, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = {
  ManpowerRequisition:
    mongoose.models.ManpowerRequisition ||
    mongoose.model('ManpowerRequisition', manpowerRequisitionSchema, 'hr_manpower_requisitions'),
  DEPARTMENTS,
  DEPARTMENT_DESIGNATIONS,
};
