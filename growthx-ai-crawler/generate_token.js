const jwt = require('jsonwebtoken');
const token = jwt.sign({ email: "test@example.com", sub: "test-user-id" }, "super-secret-jwt-key-for-growthx-ai", { expiresIn: "1h" });
console.log(token);
