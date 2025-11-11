CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"conference_id" integer NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"claimed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_conference_id_conferences_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conferences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invitations_conference_id_idx" ON "invitations" USING btree ("conference_id");--> statement-breakpoint

-- Function to handle new user signups and claim invitations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Check for pending invitations and create conference roles
  INSERT INTO public.conference_role (user_id, conference_id, role)
  SELECT 
    NEW.id, 
    conference_id, 
    role
  FROM public.invitations
  WHERE email = NEW.email 
    AND claimed_at IS NULL;
  
  -- Mark invitations as claimed
  UPDATE public.invitations
  SET claimed_at = NOW()
  WHERE email = NEW.email 
    AND claimed_at IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
--> statement-breakpoint

-- Trigger to automatically assign conference roles on user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();