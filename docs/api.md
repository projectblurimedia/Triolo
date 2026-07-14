# API Documentation

Conventions: see [[.cloud/api-guidelines.md]]. Base path: `/api/v1`.

## Auth Module

### POST /auth/register/request-otp
Request OTP for a new account.
- Auth: none
- Body: `{ fullName: string, mobileNumber: string, role: "user" | "worker" | "business_owner" }`
- 200: `{ success: true, message: "OTP sent", data: { mobileNumber } }`
- 409: mobile number already registered

### POST /auth/register/verify-otp
Verify OTP and create the account.
- Auth: none
- Body: `{ mobileNumber: string, otp: string }`
- 201: `{ success: true, message: "Account created", data: { accessToken, refreshToken, account: { id, fullName, role, status } } }`
- 400: invalid/expired/already-consumed OTP

### POST /auth/login/request-otp
Request OTP for login.
- Auth: none
- Body: `{ mobileNumber: string }`
- 200: `{ success: true, message: "OTP sent" }`
- 404: no account for this mobile number

### POST /auth/login/verify-otp
Verify OTP and log in.
- Auth: none
- Body: `{ mobileNumber: string, otp: string }`
- 200: `{ success: true, message: "Login successful", data: { accessToken, refreshToken, account: { id, fullName, role, status } } }`
- 400: invalid/expired OTP
- 403: account suspended or blocked

### POST /auth/refresh
Exchange a valid refresh token for a new access token.
- Auth: refresh token in body
- Body: `{ refreshToken: string }`
- 200: `{ success: true, data: { accessToken, refreshToken } }`
- 401: invalid/expired/revoked refresh token

### POST /auth/logout
Revoke the current refresh token.
- Auth: Bearer access token
- Body: `{ refreshToken: string }`
- 200: `{ success: true, message: "Logged out" }`

### GET /auth/me
Return the authenticated account's basic info.
- Auth: Bearer access token
- 200: `{ success: true, data: { id, fullName, mobileNumber, role, status } }`

---

Further modules (Users, Workers, Businesses, Booking, Orders, Notifications, Admin) documented here as they're implemented — never left to drift from the actual routes.
