// Research Garden renderer.
// Adapted from Philippe Laban's garden (https://tingofurro.github.io/) to match this site's palette.
// Turns a flat list of papers (with `parent` / `root_node` links) into a tree of flowers.

var flowerTemplateHTML = $('#flower_template').html();

var garden_height = 360;
const plantWidth = 400;
var root_stem_height = 50;
var root_offset = 46;
var stem_height = 64;
var root_branch_height = 28;

const waveWidth = 150, wave_offset = 62, waveHeight = 46;
const cloudWidth = 75, cloudHeight = 24, cloud_offset = 30;
var research_garden = [];
var id2paper = {};
var garden_x_offset = 0;
var windPhase = 0;

function build_garden(papers) {
    research_garden = [];
    id2paper = {};
    for(var paper of papers) {
        id2paper[paper.id] = paper;

        if(paper.root_node) {
            research_garden.push({plant_name: paper.root_name, flower_color: paper.root_color, papers: [paper]});
        }
        else {
            var parent = id2paper[paper.parent];
            if(!parent.children) {
                parent.children = [];
            }
            parent.children.push(paper);
        }
    }

    var content_width = plantWidth*research_garden.length+100;
    // Use the container width (capped to the page) so we don't force horizontal scroll on wide desktops.
    var viewport_width = $('#garden_container').width() || $(window).width();
    var garden_width = Math.max(content_width, viewport_width);
    garden_x_offset = (garden_width - content_width) / 2;
    $('#garden').width(garden_width).height(garden_height);

    renderGarden();
}

var flower_positions = {};

function createPlant(plant, x_pos, plant_index) {
    // Outer group positions the plant; inner group sways gently in the breeze
    // (so the stems/branches move too, not just the flower heads).
    const outer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    outer.setAttribute("transform", `translate(${x_pos}, ${garden_height})`);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "plant_sway");
    g.style.animationDelay = (-(plant_index * 1.7)).toFixed(2) + 's';
    g.style.animationDuration = (7.5 + plant_index * 0.8).toFixed(2) + 's';
    g.flower_color = plant.flower_color;

    // Add plant name (stays planted on the ground, doesn't sway)
    const nameLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    nameLabel.setAttribute("class", "direction-label");
    nameLabel.setAttribute("x", "0");
    nameLabel.setAttribute("y", `-${root_offset-15}`);
    const lines = plant.plant_name.split('\n');
    lines.forEach((line, index) => {
        const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
        tspan.textContent = line;
        tspan.setAttribute("x", "0");
        tspan.setAttribute("y", `${(index-1)*1.0-0.8}em`);
        tspan.setAttribute("class", `plant_label${index}`);
        nameLabel.appendChild(tspan);
    });

    // straight root stem (into the swaying group)
    const rootStem = document.createElementNS("http://www.w3.org/2000/svg", "path");
    rootStem.setAttribute("class", "stem root_stem");
    rootStem.setAttribute("d", `M0,-${root_offset} L0,-${root_stem_height+root_offset}`);
    g.appendChild(rootStem);

    plant.papers.forEach((paperTree) => {
        drawPaperTree(g, paperTree, 0, -(root_stem_height+root_offset), x_pos, plant_index);
    });

    outer.appendChild(g);
    outer.appendChild(nameLabel);
    return outer;
}
function cat_shapes(color, eye) {
    // A little side-view cat facing right; feet at y=0, centered at x=0.
    return `
        <path d="M-12,-10 C-21,-12 -21,-24 -14,-26" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>
        <ellipse cx="0" cy="-8" rx="13" ry="7.5" fill="${color}"/>
        <circle cx="11" cy="-15" r="6.5" fill="${color}"/>
        <path d="M6,-18.5 L7.5,-25 L12,-20 Z" fill="${color}"/>
        <path d="M16.5,-20 L14,-25 L10.5,-18.5 Z" fill="${color}"/>
        <circle cx="13.5" cy="-15.5" r="1.2" fill="${eye}"/>
        <rect x="-7" y="-3" width="3" height="6" rx="1.5" fill="${color}"/>
        <rect x="-1.5" y="-3" width="3" height="6" rx="1.5" fill="${color}"/>
        <rect x="5" y="-3" width="3" height="6" rx="1.5" fill="${color}"/>
        <rect x="9.5" y="-3" width="3" height="6" rx="1.5" fill="${color}"/>
    `;
}
function get_whiter_color(color, factor) {
    // the color is in the format #RRGGBB
    var r = parseInt(color.slice(1, 3), 16);
    var g = parseInt(color.slice(3, 5), 16);
    var b = parseInt(color.slice(5, 7), 16);
    r = Math.min(255, Math.max(0, r + factor));
    g = Math.min(255, Math.max(0, g + factor));
    b = Math.min(255, Math.max(0, b + factor));
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}
function drawPaperTree(parentElement, paper, x_offset, y_offset, plant_x_pos, plant_index) {
    flower_positions[paper.id] = {x: x_offset+plant_x_pos, y: y_offset};

    paper.flower_color = parentElement.flower_color;

    // An empty root has no flower or label — it's just an (underground) branch point
    // from which the real papers grow. Everything still shares this one root.
    var flower = null, label = null;
    if(!paper.empty) {
        var flower_class = `plant_${plant_index}`;
        var additional_css = `.${flower_class} {fill: url(#grad_${flower_class});} .flower:hover .${flower_class} {fill: url(#grad_${flower_class}_hover);}`;
        $('#flower_css').append(additional_css);
        // Create flower
        flower = document.createElementNS("http://www.w3.org/2000/svg", "g");
        flower.setAttribute("class", "flower");
        flower.setAttribute('id', 'flower_'+paper.id);
        var flowerHTML = flowerTemplateHTML.replaceAll(/\[\[FLOWER_CLASS\]\]/g, flower_class);
        flowerHTML = flowerHTML.replaceAll(/\[\[X\]\]/g, 0);
        flowerHTML = flowerHTML.replaceAll(/\[\[Y\]\]/g, 0);

        // put the flowerHTML into a subgroup so we can scale it on hover
        flowerHTML = `<g class='flower_subgroup'>${flowerHTML}</g>`;
        flower.innerHTML = flowerHTML;
        flower.setAttribute("onclick", `open_paper('${paper.id}')`);
        flower.setAttribute("transform", `translate(${x_offset}, ${y_offset})`);

        // Stagger each flower's sway so they don't all move in unison (more natural breeze)
        var sub = flower.querySelector('.flower_subgroup');
        if (sub) {
            sub.style.animationDelay = (-(windPhase * 0.8)).toFixed(2) + 's';
            sub.style.animationDuration = (4.6 + (windPhase % 3) * 0.5).toFixed(2) + 's';
            windPhase++;
        }

        label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("class", "label");
        label.setAttribute("onclick", `open_paper('${paper.id}')`);

        // add the venue to the title_lines
        var titleLines = paper.title.split('\n');
        if(paper.venue) {
            titleLines.push(paper.venue);
        }
        var title_x_offset = (paper.is_left_child)?x_offset-30:x_offset+30;

        titleLines.forEach((line, index) => {
            const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
            tspan.textContent = line;
            tspan.setAttribute("class", `paper_label${index} ${paper.is_left_child ? "left_child_title" : ""}`);
            tspan.setAttribute("x", title_x_offset);
            tspan.setAttribute("y", `${y_offset + 15 + (index)*20 - (0.5) * 20 * (titleLines.length)}`);
            label.appendChild(tspan);
        });
    }

    if (paper.children) {
        // The very first branch out of the empty root is kept short so the papers
        // sit close to the ground; later stems use the normal length.
        var sh = paper.empty ? root_branch_height : stem_height;
        if (paper.children.length == 1) {
            const child = paper.children[0];
            // this is just a straight line up
            const stem = document.createElementNS("http://www.w3.org/2000/svg", "path");
            stem.setAttribute("class", "stem");
            stem.setAttribute("d", `M${x_offset},${y_offset} L${x_offset},${y_offset-sh}`);
            parentElement.appendChild(stem);
            drawPaperTree(parentElement, child, x_offset, y_offset - sh, plant_x_pos, plant_index);
        }
        else if (paper.children.length == 2) {
            const leftChild = paper.children[0];
            leftChild.is_left_child = 1;
            const rightChild = paper.children[1];
            const leftStem = document.createElementNS("http://www.w3.org/2000/svg", "path");
            leftStem.setAttribute("class", "stem");
            leftStem.setAttribute("d", `M${x_offset},${y_offset} C${x_offset-30},${y_offset+5} ${x_offset-50},${y_offset} ${x_offset - 50},${y_offset-sh}`);
            parentElement.appendChild(leftStem);
            drawPaperTree(parentElement, leftChild, x_offset - 50, y_offset - sh, plant_x_pos, plant_index);
            const rightStem = document.createElementNS("http://www.w3.org/2000/svg", "path");
            rightStem.setAttribute("class", "stem");
            rightStem.setAttribute("d", `M${x_offset},${y_offset} C${x_offset+30},${y_offset+5} ${x_offset+50},${y_offset} ${x_offset + 50},${y_offset-sh}`);
            parentElement.appendChild(rightStem);
            drawPaperTree(parentElement, rightChild, x_offset + 50, y_offset - sh, plant_x_pos, plant_index);
        }
    }

    if(flower) parentElement.appendChild(flower);

    if (paper.indirect_connections) {
        paper.indirect_connections.forEach((indirect_connection) => {
            const indirect_connection_pos = flower_positions[indirect_connection];
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("class", "indirect_connection");
            line.setAttribute("x1", x_offset+plant_x_pos);
            line.setAttribute("y1", y_offset+garden_height);
            line.setAttribute("x2", indirect_connection_pos.x);
            line.setAttribute("y2", indirect_connection_pos.y+garden_height);
            $(".indirect-connections-group").append(line);
        });
    }

    if(label) parentElement.appendChild(label);

    bringFlowersToFront();
}
function open_paper(paper_id) {
    var paper = id2paper[paper_id];
    $('#paper_modal_backdrop').fadeIn(200);
    $('#paper_modal').fadeIn(200);
    $('#paper_modal_title').text(paper.full_title);
    $('#paper_modal_venue').text("— " + paper.venue);
    $('#paper_modal_content').text(paper.summary);
    var links = paper.url ? `<a href='${paper.url}' target='_blank'>${paper.url_label || 'Paper'}</a>` : '';
    if(paper.additional_links) {
        for(var link_type of Object.keys(paper.additional_links)) {
            links += `<a href="${paper.additional_links[link_type]}" target="_blank">${link_type}</a>`;
        }
    }
    $('#paper_modal_links').html(links);
}
function bringFlowersToFront() {
    var flowers = $(".flower");
    flowers.each(function() {
        // reappend it to its own parent
        $(this).appendTo($(this).parent());
    });
}

// Main rendering function
function renderGarden() {
    var garden_width = $('#garden').width();

    // Add SVG defs for gradients and filters
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
        <linearGradient id="sky_gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#eaf1fb"/>
            <stop offset="100%" stop-color="#f8f9fc"/>
        </linearGradient>
        <linearGradient id="grass_gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#8fd0c5"/>
            <stop offset="100%" stop-color="#4f9e93"/>
        </linearGradient>
        <linearGradient id="cloud_gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f4f7fd"/>
            <stop offset="100%" stop-color="#e3ecfa"/>
        </linearGradient>
        <radialGradient id="center_gradient" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#fffefa"/>
            <stop offset="100%" stop-color="#f1ebd9"/>
        </radialGradient>
        <radialGradient id="sun_gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#fff6d6"/>
            <stop offset="60%" stop-color="#ffe49a"/>
            <stop offset="100%" stop-color="#ffd56b"/>
        </radialGradient>
        <radialGradient id="sun_glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(255,228,150,0.55)"/>
            <stop offset="45%" stop-color="rgba(255,228,150,0.20)"/>
            <stop offset="100%" stop-color="rgba(255,228,150,0)"/>
        </radialGradient>
        <radialGradient id="nebelung_fur" cx="42%" cy="32%" r="72%">
            <stop offset="0%" stop-color="#bcc6d3"/>
            <stop offset="100%" stop-color="#8a97a8"/>
        </radialGradient>
        <radialGradient id="cat_glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="rgba(188,198,211,0.5)"/>
            <stop offset="55%" stop-color="rgba(188,198,211,0.16)"/>
            <stop offset="100%" stop-color="rgba(188,198,211,0)"/>
        </radialGradient>
        <radialGradient id="dew_gradient" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.9)"/>
            <stop offset="40%" stop-color="rgba(220,240,255,0.5)"/>
            <stop offset="100%" stop-color="rgba(180,215,255,0.15)"/>
        </radialGradient>
    `;
    // Create petal gradients for each plant
    research_garden.forEach((plant, index) => {
        var lighter = get_whiter_color(plant.flower_color, 50);
        var darker = get_whiter_color(plant.flower_color, -40);
        var grad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
        grad.id = `grad_plant_${index}`;
        grad.setAttribute("cx", "40%"); grad.setAttribute("cy", "30%"); grad.setAttribute("r", "70%");
        grad.innerHTML = `<stop offset="0%" stop-color="${lighter}"/><stop offset="100%" stop-color="${darker}"/>`;
        defs.appendChild(grad);
        var hoverGrad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
        hoverGrad.id = `grad_plant_${index}_hover`;
        hoverGrad.setAttribute("cx", "40%"); hoverGrad.setAttribute("cy", "30%"); hoverGrad.setAttribute("r", "70%");
        hoverGrad.innerHTML = `<stop offset="0%" stop-color="${get_whiter_color(plant.flower_color, 70)}"/><stop offset="100%" stop-color="${plant.flower_color}"/>`;
        defs.appendChild(hoverGrad);
    });
    $('#garden').prepend(defs);

    // Sky background
    const skyRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    skyRect.setAttribute("width", garden_width);
    skyRect.setAttribute("height", garden_height);
    skyRect.setAttribute("fill", "url(#sky_gradient)");
    $('#garden').append(skyRect);

    // now let's add clouds, same concept, but at the top instead of bottom
    var cloudSegments = Math.ceil(garden_width / cloudWidth);
    const wavyCloud = document.createElementNS("http://www.w3.org/2000/svg", "path");
    wavyCloud.setAttribute("class", "clouds");
    let cloudPath = `M0,0 C0,${cloud_offset+0.3*cloudHeight} 0,${cloud_offset+0.7*cloudHeight} 0,${cloud_offset}`;
    for (let i = 0; i < cloudSegments; i++) {
        const x1 = i * cloudWidth;
        const x2 = (i + 1) * cloudWidth;
        const cp1x = x1 + (cloudWidth * 0.25);
        const cp2x = x1 + (cloudWidth * 0.75);

        cloudPath += `C${cp1x},${cloud_offset + 0.3 * cloudHeight} ${cp2x},${cloud_offset + 0.7 * cloudHeight} ${x2},${cloud_offset}`;
    }
    cloudPath += ` L${garden_width},0 L0,0 Z`; // Close the path by extending to top corners
    wavyCloud.setAttribute("d", cloudPath);
    wavyCloud.setAttribute("fill", "url(#cloud_gradient)");
    $('#garden').append(wavyCloud);

    // Sunshine in the top-left corner: soft pulsing glow + slowly rotating rays + disk
    var sunX = 88, sunY = 92, sunR = 24;
    var raysHTML = '';
    for (let i = 0; i < 12; i++) {
        const a = (i * 30) * Math.PI / 180;
        const x1 = (sunX + Math.cos(a) * (sunR + 9)).toFixed(1);
        const y1 = (sunY + Math.sin(a) * (sunR + 9)).toFixed(1);
        const x2 = (sunX + Math.cos(a) * (sunR + 21)).toFixed(1);
        const y2 = (sunY + Math.sin(a) * (sunR + 21)).toFixed(1);
        raysHTML += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#ffd56b" stroke-width="3" stroke-linecap="round" opacity="0.65"/>`;
    }
    const sun = document.createElementNS("http://www.w3.org/2000/svg", "g");
    sun.setAttribute("class", "sun");
    sun.innerHTML = `
        <circle cx="${sunX}" cy="${sunY}" r="130" fill="url(#sun_glow)">
            <animate attributeName="opacity" values="0.75;1;0.75" dur="6s" repeatCount="indefinite"/>
        </circle>
        <g>
            ${raysHTML}
            <animateTransform attributeName="transform" type="rotate" from="0 ${sunX} ${sunY}" to="360 ${sunX} ${sunY}" dur="90s" repeatCount="indefinite"/>
        </g>
        <circle cx="${sunX}" cy="${sunY}" r="${sunR}" fill="url(#sun_gradient)"/>
    `;
    $('#garden').append(sun);

    // In catty mode, a Nebelung cat head takes the sun's place (blue-grey fur, green eyes)
    const sunCat = document.createElementNS("http://www.w3.org/2000/svg", "g");
    sunCat.setAttribute("class", "sun_cat");
    sunCat.setAttribute("transform", `translate(${sunX}, ${sunY})`);
    sunCat.innerHTML = `
        <circle cx="0" cy="0" r="120" fill="url(#cat_glow)">
            <animate attributeName="opacity" values="0.8;1;0.8" dur="6s" repeatCount="indefinite"/>
        </circle>
        <ellipse cx="0" cy="17" rx="27" ry="12" fill="url(#nebelung_fur)"/>
        <path d="M-22,-14 L-8,-18 L-17,-37 Z" fill="url(#nebelung_fur)"/>
        <path d="M22,-14 L8,-18 L17,-37 Z" fill="url(#nebelung_fur)"/>
        <path d="M-18,-18 L-11,-20 L-16,-32 Z" fill="#d6a8b2"/>
        <path d="M18,-18 L11,-20 L16,-32 Z" fill="#d6a8b2"/>
        <ellipse cx="0" cy="0" rx="24" ry="22" fill="url(#nebelung_fur)"/>
        <ellipse cx="-9" cy="-1" rx="5.2" ry="6.4" fill="#8fce5c"/>
        <ellipse cx="9" cy="-1" rx="5.2" ry="6.4" fill="#8fce5c"/>
        <ellipse cx="-9" cy="0" rx="2" ry="4.8" fill="#28311f"/>
        <ellipse cx="9" cy="0" rx="2" ry="4.8" fill="#28311f"/>
        <circle cx="-10.6" cy="-3.2" r="1.1" fill="#ffffff"/>
        <circle cx="7.4" cy="-3.2" r="1.1" fill="#ffffff"/>
        <path d="M-3.2,6 L3.2,6 L0,10 Z" fill="#e89aa6"/>
        <path d="M0,10 q -3,4 -6.5,2 M0,10 q 3,4 6.5,2" fill="none" stroke="#5b6470" stroke-width="1.2" stroke-linecap="round"/>
        <g stroke="#cfd6df" stroke-width="1" stroke-linecap="round" opacity="0.9">
            <line x1="-9" y1="7" x2="-31" y2="3"/>
            <line x1="-9" y1="9.5" x2="-31" y2="12"/>
            <line x1="9" y1="7" x2="31" y2="3"/>
            <line x1="9" y1="9.5" x2="31" y2="12"/>
        </g>
    `;
    $('#garden').append(sunCat);

    // Add wavy grass decoration at the bottom
    const wavyGrass = document.createElementNS("http://www.w3.org/2000/svg", "path");
    wavyGrass.setAttribute("class", "grass");

    // Create a wavy path using cubic bezier curves
    let wavePath = `M0,${garden_height - wave_offset} `;
    var waveSegments = Math.ceil(garden_width / waveWidth);
    for (let i = 0; i < waveSegments; i++) {
        const x1 = i * waveWidth;
        const x2 = (i + 1) * waveWidth;
        const cp1x = x1 + (waveWidth * 0.25);
        const cp2x = x1 + (waveWidth * 0.75);

        wavePath += `C${cp1x},${garden_height - wave_offset - 0.3 * waveHeight} ${cp2x},${garden_height - wave_offset - 0.7 * waveHeight} ${x2},${garden_height - wave_offset}`;
    }

    wavePath += ` L${garden_width},${garden_height} L0,${garden_height} Z`; // Close the path by extending to bottom corners
    wavyGrass.setAttribute("d", wavePath);
    wavyGrass.setAttribute("fill", "url(#grass_gradient)");
    $('#garden').append(wavyGrass);

    // Add indirect connections group after backgrounds so it's visible
    const indirectConnectionsGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    indirectConnectionsGroup.setAttribute("class", "indirect-connections-group");
    $('#garden').append(indirectConnectionsGroup);

    research_garden.forEach((plant, index) => {
        const x_pos = garden_x_offset + (index + 0.5) * plantWidth;
        const plantElement = createPlant(plant, x_pos, index);
        $('#garden').append(plantElement);
    });

    // Rain layer (on top, hidden unless the weather toggle is set to rainy)
    var gardenEl = document.getElementById('garden');
    gardenEl.style.setProperty('--rain-fall', garden_height + 'px');

    const rainOverlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rainOverlay.setAttribute("class", "rain_overlay");
    rainOverlay.setAttribute("width", garden_width);
    rainOverlay.setAttribute("height", garden_height);
    rainOverlay.setAttribute("fill", "rgba(120,140,170,0.18)");
    $('#garden').append(rainOverlay);

    const rain = document.createElementNS("http://www.w3.org/2000/svg", "g");
    rain.setAttribute("class", "rain");
    var dropsHTML = "";
    var dropCount = Math.min(90, Math.round(garden_width / 13));
    for (let i = 0; i < dropCount; i++) {
        const x = Math.round(Math.random() * garden_width);
        const dur = (0.7 + Math.random() * 0.6).toFixed(2);
        const delay = (-(Math.random() * 1.8)).toFixed(2);
        dropsHTML += `<line class="raindrop" x1="${x}" y1="-14" x2="${x - 2}" y2="0" style="animation-duration:${dur}s;animation-delay:${delay}s"/>`;
    }
    rain.innerHTML = dropsHTML;
    $('#garden').append(rain);

    // Cats layer (hidden unless weather is 'catty'): little cats strolling over the hills.
    // Their walk path traces the grass top wave, so they go up and down the hills.
    const cats = document.createElementNS("http://www.w3.org/2000/svg", "g");
    cats.setAttribute("class", "cats");
    var grassBase = garden_height - wave_offset;
    // Build the grass-top contour, raised by `off` so the cat's feet rest on the surface.
    function catTerrainPath(off) {
        var segFrom = -1, segTo = Math.ceil(garden_width / waveWidth) + 1;
        var p = `M${segFrom * waveWidth},${(grassBase - off).toFixed(1)}`;
        for (let i = segFrom; i < segTo; i++) {
            const x1 = i * waveWidth, x2 = (i + 1) * waveWidth;
            const cp1x = x1 + waveWidth * 0.25, cp2x = x1 + waveWidth * 0.75;
            p += ` C${cp1x},${(grassBase - off - 0.3 * waveHeight).toFixed(1)} ${cp2x},${(grassBase - off - 0.7 * waveHeight).toFixed(1)} ${x2},${(grassBase - off).toFixed(1)}`;
        }
        return p;
    }
    var catList = [
        { c: "#e8a05a", e: "#3a2a1a", dir: 1,  off: 3, dur: 20, begin: 0 },
        { c: "#9aa3ad", e: "#2a2a30", dir: -1, off: 5, dur: 26, begin: -8 },
        { c: "#4a4a52", e: "#15151a", dir: 1,  off: 2, dur: 17, begin: -5 },
        { c: "#efe7d6", e: "#7a6f58", dir: -1, off: 4, dur: 23, begin: -14 }
    ];
    var catsHTML = "";
    catList.forEach((k) => {
        const flip = k.dir === 1 ? 1 : -1;
        const path = catTerrainPath(k.off);
        // dir -1 walks the same contour in reverse (right → left), facing left.
        const reverse = k.dir === 1 ? '' : ' keyPoints="1;0" keyTimes="0;1" calcMode="linear"';
        catsHTML += `<g class="cat"><g transform="scale(${flip},1)">${cat_shapes(k.c, k.e)}</g>` +
            `<animateMotion dur="${k.dur}s" begin="${k.begin}s" repeatCount="indefinite"${reverse} path="${path}"/></g>`;
    });
    cats.innerHTML = catsHTML;
    $('#garden').append(cats);
}
function toggle_weather() {
    var c = document.getElementById('garden_container');
    var btn = document.getElementById('weather_toggle');
    var states = ['weather-sun', 'weather-rain', 'weather-cat'];
    var labels = { 'weather-sun': '☀️ Sunny', 'weather-rain': '🌧️ Rainy', 'weather-cat': '🐱 Catty' };
    var cur = states.findIndex(function (s) { return c.classList.contains(s); });
    if (cur < 0) cur = 0;
    c.classList.remove(states[cur]);
    var next = (cur + 1) % states.length;
    c.classList.add(states[next]);
    if (btn) btn.innerHTML = labels[states[next]];
}
