CREATE TABLE "user_photos" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"content_type" varchar(20) NOT NULL,
	"data" "bytea" NOT NULL,
	"size_bytes" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shop_reviews" DROP CONSTRAINT "shop_reviews_appointment_id_appointments_id_fk";
--> statement-breakpoint
ALTER TABLE "shop_reviews" ALTER COLUMN "appointment_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_reviews" ADD COLUMN "service_name" varchar(120) NOT NULL;--> statement-breakpoint
ALTER TABLE "shop_reviews" ADD COLUMN "appointment_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_reviews" ADD CONSTRAINT "shop_reviews_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;