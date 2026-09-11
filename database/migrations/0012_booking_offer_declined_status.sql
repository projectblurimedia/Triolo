-- A worker can now explicitly decline a Quick Book offer (server-side — stops it appearing
-- in their own GET /bookings/offers/mine, does not affect anyone else's eligibility), on top
-- of the existing accept/first-wins flow. See backend/src/modules/bookings/service.ts's
-- declineOffer() and .cloud/architecture.md's Notification Architecture section for the
-- client-side Accept/Reject action-button UI this backs.
ALTER TYPE booking_offer_status ADD VALUE 'declined';
