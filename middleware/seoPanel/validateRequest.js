const validateRequest = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      ok: false,
      error: 'Validation error',
      details: result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  req.body = result.data;
  return next();
};

module.exports = {
  validateRequest,
};
