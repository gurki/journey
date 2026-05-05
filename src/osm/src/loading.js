let overlay = null;
let title = null;
let detail = null;
let bar = null;


function ensureLoadingOverlay() {
    if ( overlay ) return;

    overlay = document.createElement( "aside" );
    overlay.className = "loading loading--hidden";
    overlay.setAttribute( "aria-live", "polite" );
    overlay.innerHTML = `
        <div class="loading__panel">
            <div class="loading__spinner" aria-hidden="true"></div>
            <div class="loading__copy">
                <strong id="loading-title">Preparing model</strong>
                <span id="loading-detail">Starting geometry pipeline...</span>
            </div>
            <div class="loading__track" aria-hidden="true">
                <span id="loading-bar"></span>
            </div>
        </div>
    `;

    document.body.appendChild( overlay );
    title = overlay.querySelector( "#loading-title" );
    detail = overlay.querySelector( "#loading-detail" );
    bar = overlay.querySelector( "#loading-bar" );
}


export function showLoading( message = "Preparing model", info = "", progress = 0 ) {
    ensureLoadingOverlay();
    overlay.classList.remove( "loading--hidden" );
    updateLoading( message, info, progress );
}


export function updateLoading( message, info = "", progress = undefined ) {
    ensureLoadingOverlay();
    title.textContent = message;
    detail.textContent = info;

    if ( progress !== undefined ) {
        bar.style.width = `${Math.max( 0, Math.min( 100, progress ) )}%`;
    }
}


export async function tickLoading( message, info = "", progress = undefined ) {
    updateLoading( message, info, progress );
    await new Promise( requestAnimationFrame );
}


export function hideLoading() {
    if ( ! overlay ) return;
    overlay.classList.add( "loading--hidden" );
}
