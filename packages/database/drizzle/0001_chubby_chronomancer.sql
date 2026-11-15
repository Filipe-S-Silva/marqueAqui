CREATE TABLE "platform_feedbacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"category" varchar(12) NOT NULL,
	"rating" smallint,
	"message" text NOT NULL,
	"status" varchar(10) DEFAULT 'NEW' NOT NULL,
	"handled_by_admin_id" integer,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_feedbacks_rating" CHECK ("platform_feedbacks"."rating" IS NULL OR "platform_feedbacks"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "shop_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"appointment_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"barber_id" integer,
	"rating" smallint NOT NULL,
	"comment" text,
	"reply" text,
	"replied_at" timestamp with time zone,
	"replied_by_user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_reviews_rating" CHECK ("shop_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"shop_id" integer,
	"subject" varchar(150) NOT NULL,
	"category" varchar(10) NOT NULL,
	"status" varchar(12) DEFAULT 'OPEN' NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_by" varchar(5) DEFAULT 'USER' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" integer NOT NULL,
	"author_type" varchar(5) NOT NULL,
	"author_user_id" integer,
	"author_admin_id" integer,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "shops_plan_expires_idx";--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "portal" varchar(10) DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_feedbacks" ADD CONSTRAINT "platform_feedbacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_feedbacks" ADD CONSTRAINT "platform_feedbacks_handled_by_admin_id_admins_id_fk" FOREIGN KEY ("handled_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_reviews" ADD CONSTRAINT "shop_reviews_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_reviews" ADD CONSTRAINT "shop_reviews_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_reviews" ADD CONSTRAINT "shop_reviews_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_reviews" ADD CONSTRAINT "shop_reviews_barber_id_barbers_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."barbers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_reviews" ADD CONSTRAINT "shop_reviews_replied_by_user_id_users_id_fk" FOREIGN KEY ("replied_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_author_admin_id_admins_id_fk" FOREIGN KEY ("author_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_feedbacks_status_idx" ON "platform_feedbacks" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "platform_feedbacks_user_idx" ON "platform_feedbacks" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_reviews_appointment_uq" ON "shop_reviews" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "shop_reviews_shop_idx" ON "shop_reviews" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "support_tickets_user_idx" ON "support_tickets" USING btree ("user_id","last_message_at");--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" USING btree ("status","last_message_at");--> statement-breakpoint
CREATE INDEX "ticket_messages_ticket_idx" ON "ticket_messages" USING btree ("ticket_id","created_at");--> statement-breakpoint
ALTER TABLE "shops" DROP COLUMN "plan_name";--> statement-breakpoint
ALTER TABLE "shops" DROP COLUMN "plan_expires_at";