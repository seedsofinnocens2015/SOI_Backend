const express = require('express');
const router = express.Router();
const { protectHrAuth } = require('../middleware/authMiddleware');
const {
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
} = require('../controller/masterSettingsController');

router.use(protectHrAuth);

// Master settings & dropdowns
router.get('/', getMasterSettings);
router.post('/dropdown', updateDropdownList);
router.post('/template', updateLetterTemplate);
router.post('/template/reset', resetTemplate);
router.post('/general', updateGeneralSettings);

// Companies & Letterheads
router.get('/companies', getCompanies);
router.post('/companies', createCompany);
router.put('/companies/:id', updateCompany);
router.delete('/companies/:id', deleteCompany);

// Signatories
router.post('/companies/:companyId/signatories', saveSignatory);
router.delete('/companies/:companyId/signatories/:signatoryId', deleteSignatory);

module.exports = router;
