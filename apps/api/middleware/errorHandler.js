const errorHandler = (err, req, res, next) => {
  console.error('Express Error Handler:', err);
  
  let statusCode = err.statusCode || res.statusCode;
  if (statusCode === 200) {
    statusCode = 500;
  }
  
  const responseBody = {
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  };
  console.log('[ErrorHandler sending]:', JSON.stringify(responseBody));
  res.status(statusCode).json(responseBody);
};

module.exports = { errorHandler };
