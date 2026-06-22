(function () {
  "use strict";

  function getMode() {
    const p = new URLSearchParams(location.search);
    return p.get("mode") || "standalone";
  }

  function createStandaloneAdapter(hooks) {
    return {
      init() {
        console.log("[adapter] standalone");

        const { onRowsLoaded } = hooks || {};

        // CSV読み込み（既存app.jsの処理をここに寄せる）
        const fileInput = document.getElementById("fileInput");
        if (!fileInput || typeof Papa === "undefined") return;

        fileInput.addEventListener("change", () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = () => {
            const csvText = reader.result;

            const parsed = Papa.parse(csvText, {
              header: true,
              skipEmptyLines: true,
              transformHeader: (h) => String(h).trim(),
            });

            onRowsLoaded && onRowsLoaded(parsed.data || []);
          };

          reader.readAsText(file, "utf-8");
        });
      },

      applyUiLock() {
        // standaloneは何もしない
      },
    };
  }

  function createEmbedAdapter(hooks) {
    return {
      init() {
        console.log("[adapter] embed");

        const { onRowsLoaded, onViewStateChanged } = hooks || {};

        window.parent.postMessage(
          { type: "PLOTLY_READY", version: "1" },
          window.location.origin
        );

        window.addEventListener("message", (event) => {
          if (event.origin !== window.location.origin) return;

          const msg = event.data;
          if (!msg || !msg.type) return;

          if (msg.type === "SET_VIEWSTATE") {
            onViewStateChanged &&
              onViewStateChanged({
                division: msg.division,
                startDay: msg.startDay,
                endDay: msg.endDay,
                dataKind: msg.dataKind,
              });
          }

          if (msg.type === "SET_DATA") {
            onRowsLoaded && onRowsLoaded(msg.rows || []);
          }
        });
      },

      applyUiLock() {
        const divisionSel = document.getElementById("divisionSel");
        const startDaySel = document.getElementById("startDaySel");
        const endDaySel = document.getElementById("endDaySel");

        if (divisionSel) divisionSel.disabled = true;
        if (startDaySel) startDaySel.disabled = true;
        if (endDaySel) endDaySel.disabled = true;
      },
    };
  }

  window.createViewAdapter = function (hooks) {
    const mode = getMode();
    return mode === "embed"
      ? createEmbedAdapter(hooks)
      : createStandaloneAdapter(hooks);
  };
})();