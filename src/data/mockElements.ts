import { BIMElement } from "@/types/bim";

export const MOCK_ELEMENTS: BIMElement[] = [
  {
    id: "1F4a",
    name: "Mur Extérieur - Béton 20cm",
    type: "IfcWallStandardCase",
    pset: {
      Pset_WallCommon: {
        LoadBearing: true,
        IsExternal: true,
      },
      GID_Lux: {
        Code: "21.12",
        Description: "Mur porteur",
      },
    },
  },
  {
    id: "2D8x",
    name: "Dalle R+1 - BA 25cm",
    type: "IfcSlab",
    pset: {
      Pset_SlabCommon: {
        LoadBearing: true,
      },
      GID_Lux: {
        Code: "23.01",
        Description: "Dalle pleine",
      },
    },
  },
  {
    id: "9H2k",
    name: "Fenêtre Double Vitrage",
    type: "IfcWindow",
    pset: {
      Pset_WindowCommon: {
        ThermalTransmittance: 1.2,
      },
      GID_Lux: {
        Code: "31.40",
        Description: "Chassis ALU",
      },
    },
  },
  {
    id: "4J5m",
    name: "Poteau Rect 40x40",
    type: "IfcColumn",
    pset: {
      Pset_ColumnCommon: {
        LoadBearing: true,
      },
      GID_Lux: {
        Code: "22.10",
        Description: "Poteau BA",
      },
    },
  },
];
