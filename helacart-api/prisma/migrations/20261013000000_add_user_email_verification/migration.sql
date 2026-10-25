-- Firebase owns email verification. This snapshot lets HelaCart apply policy
-- without trusting a value supplied by a web or mobile client.
ALTER TABLE "User"
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
