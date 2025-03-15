import fs from 'fs';
import path from 'path';
import usercache from '../usercache.json';
import { createCanvas } from 'canvas';
import axios from 'axios';

async function main() {
    let users = usercache.map((user) => ({
        username: user.name,
        uuid: user.uuid,
        caught: 0,
        shiny: 0,
    })).filter((user) => user.username !== 'ImShogeki');

    const playerDataFolder = fs.readdirSync(path.join(`${__dirname}/../world/cobblemonplayerdata`));

    for (const playerData of playerDataFolder) {
        const playerFolder = fs.readdirSync(path.join(`${__dirname}/../world/cobblemonplayerdata/${playerData}`));
        const statFile = playerFolder.find((file) => file.endsWith('.json'));

        if (!statFile) {
            console.log("No stat file found for", playerData);
            continue;
        }

        const playerStats = JSON.parse(fs.readFileSync(path.join(`${__dirname}/../world/cobblemonplayerdata/${playerData}/${statFile}`)).toString());

        let user = users.find((user) => user.uuid === playerStats.uuid);

        if (!user) {
            console.log("User not found for ", playerStats.uuid, "trying to fetch data from mcuuid");

            try {
                const result = await axios.get(`https://api.minecraftservices.com/minecraft/profile/lookup/${playerStats.uuid}`);
                console.log("API res", result.data);
                if (result.data.name === "ImShogeki") continue;
                user = {
                    username: result.data.name,
                    uuid: playerStats.uuid,
                    caught: 0,
                    shiny: 0,
                }

                users.push(user);
            } catch (error) {
                console.error("Error fetching data from mcuuid", error);
                continue;
            }
        }

        const pokemonStats = playerStats.extraData.cobbledex_discovery.registers;

        console.log("Processing", user!.username);
        

        for (const key in pokemonStats) {
            for (const form in pokemonStats[key]) {
                const pokemon = pokemonStats[key][form];

                if (pokemon.status === 'CAUGHT') {
                    user!.caught++;
                }
                if (pokemon.isShiny) {
                    user!.shiny++;
                }
            }
        }

        // modify user object with new stats with uuid
        users = users.map(obj => 
            obj.uuid === user!.uuid ? { ...obj, caught: user!.caught, shiny: user!.shiny } : obj
        );

        console.log("Processed", user!.username);
    }


    fs.writeFileSync(path.join(__dirname, 'users.json'), JSON.stringify(users, null, 2));

    generateLeaderboardImage(users.sort((a, b) => b.caught - a.caught));
}

function generateLeaderboardImage(stats: any[]) {
    const width = 1100, height = 400; // Increased width for right padding (add 200px)
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Colors & Styling
    const bgColor = "#1e1e1e"; // Dark background
    const textColor = "#ffffff"; // White text
    const highlightColor = "#B8860B"; // Gold for the top player
    const silverColor = "#A9A9A9"; // Silver for the second player
    const bronzeColor = "#8B5A2B"; // Bronze for the third player

    // Table settings
    const colWidth = width / 2 - 50; // Two columns
    const rowHeight = 50;
    const startX = 50, startY = 50;

    // Add padding to the second column by adjusting its X position
    const midX = startX + colWidth; // 100px of space between the columns

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = textColor;
    ctx.font = "bold 26px Arial";
    ctx.fillText("Classement", width / 2 - 100, 30);

    // Function to draw a single column
    function drawColumn(players: any, startX: any, firstColumn = false) {
        // Header row
        ctx.fillStyle = "#444"; // Darker row for header
        ctx.fillRect(startX, startY, colWidth - 50, rowHeight);
        ctx.fillStyle = textColor;
        ctx.font = "bold 18px Arial";
        ctx.fillText("Joueur", startX + 20, startY + 30);
        ctx.fillText("Capturé", startX + 250, startY + 30);
        ctx.fillText("Shiny", startX + 350, startY + 30);

        // Draw players
        players.forEach((player: any, index: any) => {
            let y = startY + rowHeight * (index + 1);

            // Highlight first place
            if (firstColumn) {
                if (index === 0) {
                    ctx.fillStyle = highlightColor;
                } else if (index === 1) {
                    ctx.fillStyle = silverColor;
                } else if (index === 2) {
                    ctx.fillStyle = bronzeColor;
                } else {
                    ctx.fillStyle = "#333";
                }
            } else {
                ctx.fillStyle = "#333";
            }
            ctx.fillRect(startX, y, colWidth -50, rowHeight);

            // Text
            ctx.fillStyle = textColor;
            ctx.font = "16px Arial";
            ctx.fillText(player.username, startX + 20, y + 30);
            ctx.fillText(player.caught, startX + 250, y + 30);
            ctx.fillText(player.shiny, startX + 350, y + 30);

            // Row separator
            ctx.strokeStyle = "#888";
            ctx.beginPath();
            ctx.moveTo(startX, y + rowHeight);
            ctx.lineTo(startX + colWidth - 50, y + rowHeight);
            ctx.stroke();
        });
    }

    // Split stats into two halves
    const half = Math.ceil(stats.length / 2);
    const leftColumn = stats.slice(0, half);
    const rightColumn = stats.slice(half);

    // Draw both columns
    drawColumn(leftColumn, startX, true);   // First column with highlight
    drawColumn(rightColumn, midX);          // Second column with padding

    const now = new Date();
    now.setHours(now.getHours() + 1); // Add 2 hours to match the server timezone
    const formattedDate = now.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    // Draw timestamp below the table
    ctx.fillStyle = "#aaa"; // Light gray
    ctx.font = "14px Arial";
    ctx.fillText(`Dernière mise à jour : ${formattedDate}`, width / 2 - 120, height - 30);

    // Save to file
    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(`${__dirname}/images/leaderboard.png`, buffer);
    console.log("Leaderboard image saved!");
}

main();