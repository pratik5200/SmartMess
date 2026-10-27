require('dotenv').config();
const prisma = require('./src/db');

const BHAWANS = [
    "Azad Bhawan",
    "Cautley Bhawan",
    "Ganga Bhawan",
    "Govind Bhawan",
    "Himalaya Bhawan",
    "Jawahar Bhawan",
    "Kasturba Bhawan",
    "Malviya Bhawan",
    "Radhakrishnan Bhawan",
    "Rajendra Bhawan",
    "Rajiv Bhawan",
    "Ravindra Bhawan",
    "Sarojini Bhawan",
    "Vigyan Kunj",
    "Vivekanand Bhawan"
];

async function seedBhawansAndMenus() {
    console.log("Seeding all Bhawans into Neon database...");

    // 1. Fetch template menus from Vivekanand Bhawan
    const templateMenus = await prisma.menu.findMany({
        where: { bhawan: { name: "Vivekanand Bhawan" } }
    });
    console.log(`Found ${templateMenus.length} template menu items to replicate if needed.`);

    for (const name of BHAWANS) {
        let bhawan = await prisma.bhawan.findUnique({
            where: { name }
        });

        if (!bhawan) {
            bhawan = await prisma.bhawan.create({
                data: { name }
            });
            console.log(`+ Created Bhawan: ${name} (${bhawan.id})`);
        } else {
            console.log(`✓ Bhawan exists: ${name} (${bhawan.id})`);
        }

        // Check if this bhawan has menus
        const menuCount = await prisma.menu.count({
            where: { bhawanId: bhawan.id }
        });

        if (menuCount === 0 && templateMenus.length > 0) {
            console.log(`  -> Copying ${templateMenus.length} menus for ${name}...`);
            const menuData = templateMenus.map(m => ({
                bhawanId: bhawan.id,
                week_start: m.week_start,
                week_end: m.week_end,
                day: m.day,
                meal_type: m.meal_type,
                start_time: m.start_time,
                end_time: m.end_time,
                items: m.items,
                averageRating: m.averageRating,
                ratingCount: m.ratingCount
            }));

            await prisma.menu.createMany({
                data: menuData
            });
            console.log(`  ✓ Menus seeded for ${name}`);
        }
    }

    const allBhawans = await prisma.bhawan.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" }
    });
    console.log("\nTotal Bhawans in database:", allBhawans.length);
    console.log(allBhawans.map(b => b.name).join(", "));
    process.exit(0);
}

seedBhawansAndMenus().catch(err => {
    console.error("Error seeding bhawans:", err);
    process.exit(1);
});
