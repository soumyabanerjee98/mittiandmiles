# Mitti and Miles

Flutter app for travellers and hosts. Admin screens stay behind the existing server capability gate and are not part of this milestone.

The app talks only to the completed `/api/v1` endpoints. Access and refresh tokens are stored in the platform keystore. When the payment intent provider is Razorpay, checkout opens the native Razorpay sheet with the server order, amount, and key. The sheet closing does not mark a booking paid. The screen keeps showing the status from `GET /bookings/:id/payment-status`.

Reviews, reports, messaging, and support tickets are not shown as working flows because those endpoints are not implemented. There is also no API to list a traveller's trip requests or a host's open requests, so those screens open a request by id. Registering an account creates a traveller. Host tools stay disabled until `GET /me` includes the `HOST` role.
