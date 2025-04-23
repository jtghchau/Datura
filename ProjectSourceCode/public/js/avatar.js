export let equippedItems = {
    head: null,
    body: null,
    pants: null
};
export let allItems = [];

export async function initializeAvatar() {
    const categories = ['head', 'body', 'pants'];
    const promises = categories.map(cat => fetch(`/api/store/${cat}`));
    
    const responses = await Promise.all(promises);
    const categoryItems = await Promise.all(responses.map(r => r.json()));
    
    allItems = categoryItems.flatMap((categoryGroup, i) => 
        categoryGroup.map(item => ({
            id: item.item_id,
            name: item.name,
            image: item.image_path,
            price: item.cost,
            category: categories[i]
        }))
    );
    
    await updateAvatar();
}

export async function fetchUserItems() {
    const response = await fetch('/api/user/items');
    const data = await response.json();
    equippedItems.head = data.equipped.head;
    equippedItems.body = data.equipped.body;
    equippedItems.pants = data.equipped.pants;
    await updateAvatar();
}

export function updateAvatar() {
    const clothingContainer = document.querySelector('.clothing-layers');
    if (!clothingContainer) return;
    
    clothingContainer.innerHTML = '';

    Object.entries(equippedItems).forEach(([category, id]) => {
        if (id) {
            const item = allItems.find(it => it.id === id);
            if (item) {
                const img = new Image();
                img.src = item.image;
                img.className = 'clothing-layer';
                img.dataset.category = category;
                clothingContainer.appendChild(img);
            }
        }
    });
}