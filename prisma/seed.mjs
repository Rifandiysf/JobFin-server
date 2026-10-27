import "dotenv/config";
import prisma from "../src/utils/prisma.client.mjs";
import bcrypt from "bcryptjs";
import { geocodeAddress, calculateRoute } from "../src/services/route.service.mjs";

const DEMO_USER = {
    name: "Demo User",
    email: "demo@jobfin.test",
    password: "Password123!",
    homeAddress: "Jl. Braga No. 1, Bandung, Jawa Barat",
};

const DUMMY_JOBS = [
    { companyName: "Gojek", position: "Frontend Engineer", status: "interview", monthsAgo: 0, daysAgo: 2, companyAddress: "Jl. Kemang Selatan Raya, Jakarta Selatan", notes: "HR interview done, waiting for the technical test schedule." },
    { companyName: "Tokopedia", position: "Fullstack Developer", status: "applied", monthsAgo: 0, daysAgo: 5, companyAddress: "Jl. Prof. Dr. Satrio, Jakarta Selatan", notes: "" },
    { companyName: "Traveloka", position: "React Developer", status: "offer", monthsAgo: 0, daysAgo: 10, companyAddress: "Jl. DR Ide Anak Agung Gde Agung, Jakarta Selatan", notes: "Negotiating salary, response deadline in 3 days." },
    { companyName: "Telkomsel", position: "Backend Engineer", status: "rejected", monthsAgo: 1, daysAgo: 3, companyAddress: "Jl. Gatot Subroto, Bandung", notes: "Failed the technical test." },
    { companyName: "Bank BCA", position: "IT Support", status: "applied", monthsAgo: 1, daysAgo: 12, companyAddress: "Jl. Asia Afrika, Bandung", notes: "" },
    { companyName: "Bukalapak", position: "Software Engineer", status: "interview", monthsAgo: 1, daysAgo: 20, companyAddress: "Jl. HR Rasuna Said, Jakarta Selatan", notes: "User interview next week." },
    { companyName: "Dicoding Indonesia", position: "Web Developer", status: "accepted", monthsAgo: 2, daysAgo: 1, companyAddress: "Jl. PHH Mustofa, Bandung", notes: "Accepted! Starting next month." },
    { companyName: "Bank Mandiri", position: "Junior Programmer", status: "rejected", monthsAgo: 2, daysAgo: 15, companyAddress: "Jl. Asia Afrika, Bandung", notes: "" },
    { companyName: "Shopee", position: "Frontend Developer", status: "applied", monthsAgo: 2, daysAgo: 25, companyAddress: "Jl. Jend. Sudirman, Jakarta Pusat", notes: "" },
    { companyName: "Telkom Indonesia", position: "Software Engineer Trainee", status: "interview", monthsAgo: 2, daysAgo: 8, companyAddress: "Jl. Japati, Bandung", notes: "User interview stage." },
    { companyName: "GudangAda", position: "Backend Developer", status: "applied", monthsAgo: 3, daysAgo: 2, companyAddress: "Jl. Casablanca Raya, Jakarta Selatan", notes: "" },
    { companyName: "Amartha", position: "Fullstack Engineer", status: "rejected", monthsAgo: 3, daysAgo: 18, companyAddress: "Jl. TB Simatupang, Jakarta Selatan", notes: "Reportedly overqualified." },
    { companyName: "XL Axiata", position: "IT Programmer", status: "applied", monthsAgo: 3, daysAgo: 22, companyAddress: "Jl. DR Ide Anak Agung Gde Agung, Jakarta Selatan", notes: "" },
    { companyName: "PT Pos Indonesia", position: "Web Developer", status: "applied", monthsAgo: 0, daysAgo: 1, companyAddress: "Jl. Cilaki, Bandung", notes: "Just submitted the application today." },
    { companyName: "Bank BNI", position: "Programmer Analyst", status: "interview", monthsAgo: 0, daysAgo: 7, companyAddress: "Jl. Braga, Bandung", notes: "Online technical test this week." },
];

function subDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() - days);
    return result;
}

function subMonths(date, months) {
    const result = new Date(date);
    result.setMonth(result.getMonth() - months);
    return result;
}

async function main() {
    console.log("Seeding demo account...");

    const existing = await prisma.user.findUnique({ where: { email: DEMO_USER.email } });
    if (existing) {
        await prisma.jobApplication.deleteMany({ where: { userId: existing.id } });
        await prisma.user.delete({ where: { id: existing.id } });
        console.log("Previous demo account removed, recreating...");
    }

    console.log(`Geocoding home address: ${DEMO_USER.homeAddress}`);
    const home = await geocodeAddress(DEMO_USER.homeAddress);

    const hashedPassword = await bcrypt.hash(DEMO_USER.password, 10);

    const user = await prisma.user.create({
        data: {
            name: DEMO_USER.name,
            email: DEMO_USER.email,
            password: hashedPassword,
            provider: "local",
            emailVerifiedAt: new Date(),
            homeAddress: DEMO_USER.homeAddress,
            homeLat: home.lat,
            homeLng: home.lng,
            theme: "light",
        },
    });

    console.log(`User created: ${user.email} (id: ${user.id})`);
    console.log(`Creating ${DUMMY_JOBS.length} job applications...`);

    const now = new Date();

    for (const [index, job] of DUMMY_JOBS.entries()) {
        const appliedDate = subDays(subMonths(now, job.monthsAgo), job.daysAgo);

        let routeData = {};

        try {
            // Requests are throttled inside the map services, so no manual delay is needed.
            const company = await geocodeAddress(job.companyAddress, { biasLocation: home });

            const route = await calculateRoute({
                fromLat: home.lat,
                fromLng: home.lng,
                toLat: company.lat,
                toLng: company.lng,
            });

            routeData = {
                companyLat: company.lat,
                companyLng: company.lng,
                distanceKm: route.distanceKm,
                durationMin: route.durationMin,
                routeGeometry: route.geometry,
                routeFetchedAt: new Date(),
            };

            console.log(`  [${index + 1}/${DUMMY_JOBS.length}] ${job.companyName} -> ${route.distanceKm} km`);
        } catch (err) {
            console.warn(`  [${index + 1}/${DUMMY_JOBS.length}] ${job.companyName} -> geocoding or routing failed, skipped (${err.message})`);
        }

        await prisma.jobApplication.create({
            data: {
                userId: user.id,
                companyName: job.companyName,
                position: job.position,
                status: job.status,
                appliedDate,
                companyAddress: job.companyAddress,
                notes: job.notes || null,
                ...routeData,
            },
        });
    }

    console.log("\nDone! Log in with the following account for testing:");
    console.log(`  Email    : ${DEMO_USER.email}`);
    console.log(`  Password : ${DEMO_USER.password}`);
}

main()
    .catch((err) => {
        console.error("Seed failed:", err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });