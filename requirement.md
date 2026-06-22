# Task
- Build a small public seat reservation platform using any TypeScript stack
- this is an code challenge/assestment, we can use simple approach but have to note the trade off

# Core Requirements:
- Must use typescript
- NextJS framework for frontend or NextJS for both front end and backend
- The application should display 3 available seats that can be reserved by authenticated users.
## Features - Users should be able to
- Login with session expiry at 90 days
- Select a seat
- Proceed to payment
- Successfully reserve the seat upon payment completion
## modules
- auth
- seat
- reservation
- payment
## architecture descicion
- Race condition: these only 3 seats with many users - don't allow 2 user buy 1 seat by using select for update
- 90 days expired jwt token for simplicity - don't use refresh token for this challenge
## Payment flow:
- Reserve Seat -> PENDING_PAYMENT -> Mock Payment -> SUCCESS -> CONFIRMED 
- after click pay, status is PENDING_PAYMENT
- use TTL: user has 10 minutes to complete the payment after click pay
- use job to clean up pending payment - run every minute
- use use mock payment for simplicity
