
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, query, orderBy, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Droplet, Flame, Sun, Shapes, PlusCircle, Edit as EditIcon, Trash2, Eye, EyeOff, Loader2, ShieldAlert, Server, KeyRound, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { UserProfile, VendorData, TokenSettingValues, AreaHierarchy, AllTokenSettings, SelectedHierarchy, AreaInHierarchy, ProjectInArea as HierarchyProject, VendorInProject } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { UserRole } from '@/types';

const tokenTypes = [
  { name: 'ELECTRICITY', displayName: 'LISTRIK', icon: Zap, description: 'Manage electricity tokens.', dataAiHint: 'lightning bolt' },
  { name: 'WATER', displayName: 'AIR', icon: Droplet, description: 'Manage water tokens.', dataAiHint: 'water drop' },
  { name: 'GAS', displayName: 'GAS', icon: Flame, description: 'Manage gas tokens.', dataAiHint: 'fire flame' },
  { name: 'SOLAR', displayName: 'SOLAR', icon: Sun, description: 'Manage solar energy tokens.', dataAiHint: 'sun energy' },
];

const basePriceLabels: Record<string, string> = {
  ELECTRICITY: 'Base Price per KWh (Rp)',
  WATER: 'Base Price per m³ (Rp)',
  GAS: 'Base Price per m³ (Rp)',
  SOLAR: 'Base Price per kWp (Rp)',
  DEFAULT: 'Base Price per Token (Rp)',
};

const initialAreaHierarchyDataPerToken: Record<string, AreaHierarchy> = {
  ELECTRICITY: [
    { 
      name: "Jakarta Pusat", 
      projects: [
        { name: "Apartemen Menteng", vendors: [{ name: "PT Listrik Air Sejahtera" }, { name: "Vendorindo Electric Gas" }, { name: "Multi Energi Solusindo" }] },
        { name: "Perkantoran Sudirman", vendors: [{ name: "PT Listrik Air Sejahtera" }, { name: "Multi Energi Solusindo" }] }
      ] 
    },
    { 
      name: "Bandung Kota", 
      projects: [
        { name: "Kawasan Dago", vendors: [{ name: "PT Listrik Air Sejahtera" }, { name: "Vendorindo Electric Gas" }] },
        { name: "Gedebage Technopolis", vendors: [{ name: "Multi Energi Solusindo" }] }
      ] 
    },
  ],
  WATER: [
    { 
      name: "Depok", 
      projects: [
        { name: "Perumahan Sawangan", vendors: [{ name: "PT Listrik Air Sejahtera" }, { name: "Sumber Air Tenaga Surya Nusantara" }, { name: "Multi Energi Solusindo" }] },
        { name: "Distrik Cimanggis", vendors: [{ name: "PT Listrik Air Sejahtera" }] }
      ] 
    },
    { 
      name: "Tangerang Selatan", 
      projects: [
        { name: "BSD City", vendors: [{ name: "Sumber Air Tenaga Surya Nusantara" }, { name: "Multi Energi Solusindo" }] },
        { name: "Alam Sutera", vendors: [{ name: "PT Listrik Air Sejahtera" }, { name: "Multi Energi Solusindo" }] }
      ] 
    },
  ],
  GAS: [
    { 
      name: "Bekasi Industri", 
      projects: [
        { name: "Kawasan MM2100", vendors: [{ name: "CV Gas Surya Prima" }, { name: "Vendorindo Electric Gas" }, { name: "Multi Energi Solusindo" }] },
        { name: "Area Jababeka", vendors: [{ name: "Vendorindo Electric Gas" }] }
      ] 
    },
    { 
      name: "Karawang", 
      projects: [
        { name: "Zona Industri KIIC", vendors: [{ name: "CV Gas Surya Prima" }, { name: "Multi Energi Solusindo" }] },
        { name: "Pabrik Suryacipta", vendors: [{ name: "CV Gas Surya Prima" }]}
      ] 
    },
  ],
  SOLAR: [
    { 
      name: "Bali Selatan", 
      projects: [
        { name: "Villa Canggu", vendors: [{ name: "CV Gas Surya Prima" }, { name: "Sumber Air Tenaga Surya Nusantara" }, { name: "Solar Panel Jaya Abadi" }] },
        { name: "Resort Nusa Dua", vendors: [{ name: "Solar Panel Jaya Abadi" }] }
      ] 
    },
    { 
      name: "Lombok Barat", 
      projects: [
        { name: "Proyek Energi Terbarukan Senggigi", vendors: [{ name: "CV Gas Surya Prima" }, { name: "Sumber Air Tenaga Surya Nusantara" }] },
        { name: "Hotel Gili Trawangan", vendors: [{ name: "Solar Panel Jaya Abadi" }, {name: "CV Gas Surya Prima"}]}
      ] 
    },
  ],
};

const initialTokenValues: TokenSettingValues = { basePrice: '', pajak: '', adminFee: '', otherCosts: '' };

const generateInitialTokenSettings = (hierarchies: Record<string, AreaHierarchy>): AllTokenSettings => {
  const settings: AllTokenSettings = {};
  Object.keys(hierarchies).forEach(tokenName => {
    settings[tokenName] = {};
    if (Array.isArray(hierarchies[tokenName])) {
      hierarchies[tokenName].forEach(area => {
        settings[tokenName][area.name] = {};
        if (Array.isArray(area.projects)) {
          area.projects.forEach(project => {
            settings[tokenName][area.name][project.name] = {};
            if (Array.isArray(project.vendors)) {
              project.vendors.forEach(vendor => {
                settings[tokenName][area.name][project.name][vendor.name] = { ...initialTokenValues };
              });
            }
          });
        }
      });
    }
  });
  return settings;
};

const getInitialSelectedHierarchy = (
  hierarchies: Record<string, AreaHierarchy>,
  globalVendors: VendorData[],
  currentUser: UserProfile | null
): Record<string, SelectedHierarchy> => {
  const selections: Record<string, SelectedHierarchy> = {};
  tokenTypes.forEach(token => {
    const tokenName = token.name;
    const defaultSelection: SelectedHierarchy = { area: '', project: '', vendor: '' };
    let tokenHierarchy = hierarchies[tokenName] || [];

    if (currentUser?.role === UserRole.VENDOR && currentUser.displayName) {
      const loggedInVendorName = currentUser.displayName;
      // Filter hierarchy for the logged-in vendor if it hasn't been pre-filtered
      // This check might be redundant if hierarchies are already filtered in loadData
      tokenHierarchy = tokenHierarchy.filter(area =>
        area.projects.some(project =>
          project.vendors.some(v => v.name === loggedInVendorName)
        )
      ).map(area => ({
        ...area,
        projects: area.projects.filter(project =>
          project.vendors.some(v => v.name === loggedInVendorName)
        ).map(project => ({
          ...project,
          vendors: project.vendors.filter(v => v.name === loggedInVendorName)
        }))
      }));
    }

    if (tokenHierarchy.length > 0 && tokenHierarchy[0]) {
      defaultSelection.area = tokenHierarchy[0].name;
      if (tokenHierarchy[0].projects && tokenHierarchy[0].projects.length > 0 && tokenHierarchy[0].projects[0]) {
        defaultSelection.project = tokenHierarchy[0].projects[0].name;
        const projectVendorsFromHierarchy = tokenHierarchy[0].projects[0].vendors;

        if (currentUser?.role === UserRole.VENDOR && currentUser.displayName) {
          if (projectVendorsFromHierarchy && projectVendorsFromHierarchy.some(v => v.name === currentUser.displayName)) {
            defaultSelection.vendor = currentUser.displayName;
          }
        } else if (projectVendorsFromHierarchy && projectVendorsFromHierarchy.length > 0) {
          const firstValidVendor = projectVendorsFromHierarchy.find(pv => {
            const globalVendor = globalVendors.find(gv => gv.name === pv.name);
            return globalVendor && Array.isArray(globalVendor.handledServices) && globalVendor.handledServices.includes(tokenName);
          });
          if (firstValidVendor) {
            defaultSelection.vendor = firstValidVendor.name;
          } else if (projectVendorsFromHierarchy[0]) {
            defaultSelection.vendor = projectVendorsFromHierarchy[0].name;
          }
        }
      }
    }
    selections[tokenName] = defaultSelection;
  });
  return selections;
};


const initialStronpowerCreds = {
    apiUrl: "http://www.server-api.stronpower.com/api/VendingMeter",
    companyName: "saitec",
    userName: "Admin007",
    password: "SAI123#",
};

export default function TokenPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [areaHierarchy, setAreaHierarchy] = useState<Record<string, AreaHierarchy>>({});
  const [allGlobalVendors, setAllGlobalVendors] = useState<VendorData[]>([]);

  const [tokenSettings, setTokenSettings] = useState<AllTokenSettings>({});
  const [selectedHierarchy, setSelectedHierarchy] = useState<Record<string, SelectedHierarchy>>({});

  const [editModes, setEditModes] = useState<Record<string, boolean>>(
    tokenTypes.reduce((acc, token) => ({ ...acc, [token.name]: false }), {})
  );

  const [showAddHierarchyDialog, setShowAddHierarchyDialog] = useState(false);
  const [activeTokenForHierarchyModal, setActiveTokenForHierarchyModal] = useState<string | null>(null);
  const [newAreaNameInput, setNewAreaNameInput] = useState('');
  const [newProjectNameInput, setNewProjectNameInput] = useState('');
  const [newVendorNameInput, setNewVendorNameInput] = useState('');

  const [showEditHierarchyDialog, setShowEditHierarchyDialog] = useState(false);
  const [hierarchyToEdit, setHierarchyToEdit] = useState<{tokenName: string; area: string; project: string; vendor: string} | null>(null);
  const [editedAreaNameInput, setEditedAreaNameInput] = useState('');
  const [editedProjectNameInput, setEditedProjectNameInput] = useState('');
  const [editedVendorNameInput, setEditedVendorNameInput] = useState('');

  const [showDeleteHierarchyAlert, setShowDeleteHierarchyAlert] = useState(false);
  const [hierarchyToDelete, setHierarchyToDelete] = useState<{tokenName: string; area: string; project: string; vendor?: string} | null>(null);
  
  const [showSupervisionPasswordDialog, setShowSupervisionPasswordDialog] = useState(false);
  const [supervisionPasswordInput, setSupervisionPasswordInput] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [itemPendingSupervisionDelete, setItemPendingSupervisionDelete] = useState<{tokenName: string; area: string; project: string; vendor?: string} | null>(null);

  const [stronpowerApiUrl, setStronpowerApiUrl] = useState(initialStronpowerCreds.apiUrl);
  const [stronpowerCompanyName, setStronpowerCompanyName] = useState(initialStronpowerCreds.companyName);
  const [stronpowerUserName, setStronpowerUserName] = useState(initialStronpowerCreds.userName);
  const [stronpowerPassword, setStronpowerPassword] = useState(initialStronpowerCreds.password);
  const [isStronpowerCredsEditing, setIsStronpowerCredsEditing] = useState(false);
  const [showStronpowerApiPassword, setShowStronpowerApiPassword] = useState(false);
  const [isSavingStronpowerCreds, setIsSavingStronpowerCreds] = useState(false);


  const vendorsCollectionRef = useMemo(() => collection(db, 'vendors'), []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingData(true);
      try {
        const vendorsSnap = await getDocs(query(vendorsCollectionRef, orderBy('name', 'asc')));
        const fetchedVendors = vendorsSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, registrationDate: (doc.data().registrationDate as Timestamp)?.toDate ? (doc.data().registrationDate as Timestamp).toDate() : new Date(), handledServices: doc.data().handledServices || [] }) as VendorData);
        setAllGlobalVendors(fetchedVendors);

        const loadedHierarchies: Record<string, AreaHierarchy> = {};
        const loadedSettings: AllTokenSettings = {};

        for (const token of tokenTypes) {
          const tokenName = token.name;
          const hierarchyDocRef = doc(db, 'appConfiguration', `hierarchy_${tokenName}`);
          const settingsDocRef = doc(db, 'appConfiguration', `settings_${tokenName}`);

          const [hierarchyDocSnap, settingsDocSnap] = await Promise.all([
            getDoc(hierarchyDocRef),
            getDoc(settingsDocRef),
          ]);

          if (hierarchyDocSnap.exists()) {
            loadedHierarchies[tokenName] = (hierarchyDocSnap.data().hierarchy || []) as AreaHierarchy;
          } else {
            loadedHierarchies[tokenName] = initialAreaHierarchyDataPerToken[tokenName] || [];
            await setDoc(hierarchyDocRef, { hierarchy: loadedHierarchies[tokenName] });
          }

          if (settingsDocSnap.exists()) {
            loadedSettings[tokenName] = settingsDocSnap.data()?.settings?.[tokenName] || {};
          } else {
            const singleTokenHierarchy = { [tokenName]: loadedHierarchies[tokenName] };
            const initialSettingsForToken = generateInitialTokenSettings(singleTokenHierarchy);
            loadedSettings[tokenName] = initialSettingsForToken[tokenName] || {};
            await setDoc(settingsDocRef, { settings: { [tokenName]: loadedSettings[tokenName] } });
          }
        }
        
        // Filter data for Vendor role
        if (user?.role === UserRole.VENDOR && user.displayName) {
          const vendorName = user.displayName;
          const vendorDetails = fetchedVendors.find(v => v.name === vendorName);
          const handledServicesByVendor = vendorDetails?.handledServices || [];

          Object.keys(loadedHierarchies).forEach(tokenName => {
            if (!handledServicesByVendor.includes(tokenName)) {
              loadedHierarchies[tokenName] = []; 
              if (loadedSettings[tokenName]) {
                loadedSettings[tokenName] = {};
              }
              return;
            }

            loadedHierarchies[tokenName] = (loadedHierarchies[tokenName] || []).filter(area =>
              area.projects.some(project =>
                project.vendors.some(v => v.name === vendorName)
              )
            ).map(area => ({
              ...area,
              projects: area.projects.filter(project =>
                project.vendors.some(v => v.name === vendorName)
              ).map(project => ({
                ...project,
                vendors: project.vendors.filter(v => v.name === vendorName) // Only show own vendor
              }))
            }));
            
            // Filter settings to only include the vendor's own settings
            if (loadedSettings[tokenName]) {
                const filteredSettingsForToken: AllTokenSettings[string] = {};
                for (const area of loadedHierarchies[tokenName]) {
                    if (loadedSettings[tokenName][area.name]) {
                        filteredSettingsForToken[area.name] = {};
                        for (const project of area.projects) {
                            if (loadedSettings[tokenName][area.name][project.name]) {
                                filteredSettingsForToken[area.name][project.name] = {};
                                const vendorSetting = loadedSettings[tokenName][area.name][project.name][vendorName];
                                if (vendorSetting) {
                                    filteredSettingsForToken[area.name][project.name][vendorName] = vendorSetting;
                                }
                            }
                        }
                    }
                }
                loadedSettings[tokenName] = filteredSettingsForToken;
            }
          });
        }

        setAreaHierarchy(loadedHierarchies);
        setTokenSettings(loadedSettings);
        setSelectedHierarchy(getInitialSelectedHierarchy(loadedHierarchies, fetchedVendors, user));

        const stronpowerCredsDocRef = doc(db, 'appConfiguration', 'stronpowerApiCredentials');
        const stronpowerCredsSnap = await getDoc(stronpowerCredsDocRef);
        if (stronpowerCredsSnap.exists()) {
            const creds = stronpowerCredsSnap.data();
            setStronpowerApiUrl(creds.apiUrl || initialStronpowerCreds.apiUrl);
            setStronpowerCompanyName(creds.companyName || initialStronpowerCreds.companyName);
            setStronpowerUserName(creds.userName || initialStronpowerCreds.userName);
            setStronpowerPassword(creds.password || initialStronpowerCreds.password);
        } else {
            await setDoc(stronpowerCredsDocRef, initialStronpowerCreds);
        }

      } catch (error) {
        console.error("Error loading token management data:", error);
        toast({ title: "Error", description: "Gagal memuat data token management.", variant: "destructive" });
        const defaultHierarchies = JSON.parse(JSON.stringify(initialAreaHierarchyDataPerToken));
        setAreaHierarchy(defaultHierarchies);
        setAllGlobalVendors([]); 
        setTokenSettings(generateInitialTokenSettings(defaultHierarchies));
        setSelectedHierarchy(getInitialSelectedHierarchy(defaultHierarchies, [], user));
      } finally {
        setIsLoadingData(false);
      }
    };
    if (user) { // Ensure user is loaded before fetching data
        loadData();
    } else {
        setIsLoadingData(false); // If no user, stop loading
    }
  }, [toast, vendorsCollectionRef, user]); // Add user to dependency array

  const saveHierarchyToFirestore = async (tokenName: string, hierarchy: AreaHierarchy) => {
    try {
      const hierarchyDocRef = doc(db, 'appConfiguration', `hierarchy_${tokenName}`);
      await setDoc(hierarchyDocRef, { hierarchy });
    } catch (error) {
      console.error(`Error saving hierarchy for ${tokenName}:`, error);
      toast({ title: "Error Menyimpan Hierarki", description: (error as Error).message, variant: "destructive" });
      throw error;
    }
  };

  const saveSettingsToFirestore = async (tokenName: string, settingsForToken: AllTokenSettings[string]) => {
    try {
      const settingsDocRef = doc(db, 'appConfiguration', `settings_${tokenName}`);
      await setDoc(settingsDocRef, { settings: { [tokenName]: settingsForToken } });
    } catch (error) {
      console.error(`Error saving token settings for ${tokenName}:`, error);
      toast({ title: "Error Menyimpan Pengaturan Token", description: (error as Error).message, variant: "destructive" });
      throw error;
    }
  };

 const getProjectsForArea = useCallback((tokenName: string, areaName: string): HierarchyProject[] => {
    const currentTokenHierarchy = areaHierarchy[tokenName];
    if (!currentTokenHierarchy || !Array.isArray(currentTokenHierarchy)) return [];
    const area = currentTokenHierarchy.find(a => a.name === areaName);
    
    if (user?.role === UserRole.VENDOR && user.displayName && area) {
        const loggedInVendorName = user.displayName;
        return (area.projects || []).filter(project => 
            project.vendors.some(v => v.name === loggedInVendorName)
        );
    }
    return (area && Array.isArray(area.projects) ? area.projects : []) || [];
  }, [areaHierarchy, user]);


  const getVendorsForProject = useCallback((tokenName: string, areaName: string, projectName: string): VendorInProject[] => {
    const currentTokenHier = areaHierarchy[tokenName];
    if (!currentTokenHier || !Array.isArray(currentTokenHier)) return [];

    const area = currentTokenHier.find(a => a.name === areaName);
    if (!area || !Array.isArray(area.projects)) return [];

    const projectInHierarchy = area.projects.find(p => p.name === projectName);
    if (!projectInHierarchy || !Array.isArray(projectInHierarchy.vendors)) return [];

    if (user?.role === UserRole.VENDOR && user.displayName) {
        const loggedInVendorName = user.displayName;
        return projectInHierarchy.vendors.filter(v => v.name === loggedInVendorName);
    }

    const vendorNamesInHierarchy = projectInHierarchy.vendors
      .map(v => (typeof v === 'object' && v !== null && typeof v.name === 'string' ? v.name : null))
      .filter((name): name is string => name !== null);

    const validGlobalVendors = allGlobalVendors.filter(globalVendor => {
      if (!globalVendor.name) return false; 
      const handlesService = Array.isArray(globalVendor.handledServices) && globalVendor.handledServices.includes(tokenName);
      const isInHierarchyForThisPath = vendorNamesInHierarchy.includes(globalVendor.name);
      return handlesService && isInHierarchyForThisPath;
    });

    return validGlobalVendors
      .map(v => ({ name: v.name! })) 
      .sort((a, b) => a.name.localeCompare(b.name));

  }, [areaHierarchy, allGlobalVendors, user]);


  const handleAreaChange = (tokenName: string, newArea: string) => {
    const projectsInNewArea = getProjectsForArea(tokenName, newArea);
    let newProjectSelection = '';
    let newVendorSelection = '';

    if (projectsInNewArea.length > 0 && projectsInNewArea[0]) {
        newProjectSelection = projectsInNewArea[0].name;
        const vendorsInNewProject = getVendorsForProject(tokenName, newArea, newProjectSelection);
        if (user?.role === UserRole.VENDOR && user.displayName) {
            newVendorSelection = user.displayName; // Vendor can only select themselves
        } else if (vendorsInNewProject.length > 0 && vendorsInNewProject[0]) {
            newVendorSelection = vendorsInNewProject[0].name;
        }
    }

    setSelectedHierarchy(prev => ({
      ...prev,
      [tokenName]: { area: newArea, project: newProjectSelection, vendor: newVendorSelection },
    }));
    setEditModes(prev => ({ ...prev, [tokenName]: false }));
  };

  const handleProjectChange = (tokenName: string, newProject: string) => {
    const currentArea = selectedHierarchy[tokenName]?.area || '';
    let newVendorSelection = '';
    if (currentArea && newProject) {
        const vendorsInNewProject = getVendorsForProject(tokenName, currentArea, newProject);
         if (user?.role === UserRole.VENDOR && user.displayName) {
            newVendorSelection = user.displayName; // Vendor can only select themselves
        } else if (vendorsInNewProject.length > 0 && vendorsInNewProject[0]) {
            newVendorSelection = vendorsInNewProject[0].name;
        }
    }
    setSelectedHierarchy(prev => ({
      ...prev,
      [tokenName]: { ...(prev[tokenName] || {area: currentArea, project: '', vendor: ''}), project: newProject, vendor: newVendorSelection },
    }));
    setEditModes(prev => ({ ...prev, [tokenName]: false }));
  };

  const handleVendorChange = (tokenName: string, newVendor: string) => {
    if (user?.role === UserRole.VENDOR && user.displayName && newVendor !== user.displayName) {
        // Vendor should not be able to change from themselves if the dropdown is somehow enabled
        toast({ title: "Aksi Tidak Diizinkan", description: "Vendor hanya dapat memilih dirinya sendiri.", variant: "destructive"});
        return;
    }
    setSelectedHierarchy(prev => ({
      ...prev,
      [tokenName]: { ...(prev[tokenName] || {area: '', project: '', vendor: ''}), vendor: newVendor },
    }));
    setEditModes(prev => ({ ...prev, [tokenName]: false }));
  };

  const displayFormattedNumber = (value: string | undefined): string => {
    if (value === undefined || value === null || String(value).trim() === '') return '';
    const rawValue = String(value).replace(/[^0-9]/g, '');
    if (rawValue === '') return '';
    const num = Number(rawValue);
    return isNaN(num) ? '' : num.toLocaleString('id-ID');
  };

  const handleInputChange = (tokenName: string, field: keyof TokenSettingValues, inputValue: string) => {
    const currentSelection = selectedHierarchy[tokenName];
    if (!currentSelection || !currentSelection.area || !currentSelection.project || !currentSelection.vendor) return;
    
    if (user?.role === UserRole.VENDOR && user.displayName && currentSelection.vendor !== user.displayName) {
        toast({title: "Aksi Tidak Diizinkan", description: "Anda hanya dapat mengubah pengaturan untuk vendor Anda sendiri.", variant: "destructive"});
        return;
    }

    let processedValue = inputValue;
    if (field === 'basePrice' || field === 'adminFee' || field === 'otherCosts') {
      processedValue = inputValue.replace(/[^0-9]/g, '');
    }

    setTokenSettings(prev => {
      const newSettings = JSON.parse(JSON.stringify(prev));
      if (!newSettings[tokenName]) newSettings[tokenName] = {};
      if (!newSettings[tokenName][currentSelection.area]) newSettings[tokenName][currentSelection.area] = {};
      if (!newSettings[tokenName][currentSelection.area][currentSelection.project]) newSettings[tokenName][currentSelection.area][currentSelection.project] = {};

      newSettings[tokenName][currentSelection.area][currentSelection.project][currentSelection.vendor] = {
        ...(newSettings[tokenName]?.[currentSelection.area]?.[currentSelection.project]?.[currentSelection.vendor] || initialTokenValues),
        [field]: processedValue,
      };
      return newSettings;
    });
  };

  const handleUbahClick = (tokenName: string) => {
    const currentSelection = selectedHierarchy[tokenName];
    if (user?.role === UserRole.VENDOR && user.displayName) {
        if (!currentSelection || currentSelection.vendor !== user.displayName) {
            toast({ title: "Aksi Tidak Diizinkan", description: "Anda hanya dapat mengubah harga untuk vendor Anda sendiri.", variant: "destructive" });
            return;
        }
    }
    setEditModes(prev => ({ ...prev, [tokenName]: !prev[tokenName] }));
  };

  const handleSimpanClick = async (tokenName: string) => {
    const currentSelection = selectedHierarchy[tokenName];
     if (!currentSelection.area || !currentSelection.project || !currentSelection.vendor) {
        toast({ title: "Error", description: "Lengkapi pilihan Area, Project, dan Vendor.", variant: "destructive" });
        return;
    }

    if (user?.role === UserRole.VENDOR && user.displayName && currentSelection.vendor !== user.displayName) {
        toast({ title: "Aksi Tidak Diizinkan", description: "Anda hanya dapat menyimpan pengaturan untuk vendor Anda sendiri.", variant: "destructive" });
        return;
    }

    const currentTokenData = tokenTypes.find(t => t.name === tokenName);
    const displayName = currentTokenData?.displayName || tokenName;
    const settingsToSave = tokenSettings[tokenName];

    if (!settingsToSave) {
        toast({ title: "Error", description: `Pengaturan untuk ${displayName} tidak ditemukan.`, variant: "destructive" });
        return;
    }
    
    try {
        await saveSettingsToFirestore(tokenName, settingsToSave);
        setEditModes(prev => ({ ...prev, [tokenName]: false })); 
        toast({ title: "Pengaturan Disimpan", description: `Pengaturan untuk ${displayName} pada ${currentSelection.area} > ${currentSelection.project} > ${currentSelection.vendor} telah disimpan.`});
    } catch (error) { 
    }
  };

  const handleOpenAddHierarchyDialog = (tokenName: string) => {
    if (user?.role === UserRole.VENDOR) {
        toast({title: "Aksi Tidak Diizinkan", description: "Vendor tidak dapat menambah hierarki baru.", variant: "destructive"});
        return;
    }
    setActiveTokenForHierarchyModal(tokenName);
    setNewAreaNameInput('');
    setNewProjectNameInput('');
    setNewVendorNameInput('');
    setShowAddHierarchyDialog(true);
  };

 const handleConfirmAddHierarchy = async () => {
    if (user?.role === UserRole.VENDOR) return;
    if (!activeTokenForHierarchyModal) return;
    const tokenName = activeTokenForHierarchyModal;
    const currentTokenData = tokenTypes.find(t => t.name === tokenName);
    const displayName = currentTokenData?.displayName || tokenName;

    const areaName = newAreaNameInput.trim();
    const projectName = newProjectNameInput.trim();
    const vendorName = newVendorNameInput.trim();

    if (!areaName || !projectName || !vendorName) {
      toast({ title: "Kesalahan Validasi", description: "Nama Area, Nama Project, dan Nama Vendor harus diisi.", variant: "destructive" });
      return;
    }
     if (!allGlobalVendors.find(v => v.name === vendorName)) {
      toast({ title: "Kesalahan Validasi", description: `Vendor "${vendorName}" tidak ditemukan dalam daftar vendor global. Silakan tambahkan vendor terlebih dahulu.`, variant: "destructive" });
      return;
    }
    const globalVendorSelected = allGlobalVendors.find(v => v.name === vendorName);
    if (globalVendorSelected && Array.isArray(globalVendorSelected.handledServices) && !globalVendorSelected.handledServices.includes(tokenName)) {
        toast({ title: "Kesalahan Validasi", description: `Vendor "${vendorName}" tidak menangani jenis token ${displayName}. Pilih vendor yang sesuai.`, variant: "destructive" });
        return;
    }


    const updatedTokenHierarchy = JSON.parse(JSON.stringify(areaHierarchy[tokenName] || [])) as AreaHierarchy;
    const updatedTokenSpecificSettings = JSON.parse(JSON.stringify(tokenSettings[tokenName] || {})) as AllTokenSettings[string];

    let areaObj = updatedTokenHierarchy.find(a => a.name === areaName);
    if (!areaObj) {
      areaObj = { name: areaName, projects: [] };
      updatedTokenHierarchy.push(areaObj);
    }

    let projectObj = areaObj.projects.find(p => p.name === projectName);
    if (!projectObj) {
      projectObj = { name: projectName, vendors: [] };
      areaObj.projects.push(projectObj);
    }
    
    if (!Array.isArray(projectObj.vendors)) { 
        projectObj.vendors = [];
    }

    if (projectObj.vendors.some(v => v.name === vendorName)) {
      toast({ title: "Entri Duplikat", description: `Vendor "${vendorName}" sudah ada di Project "${projectName}" Area "${areaName}" untuk token ${displayName}.`, variant: "destructive" });
      return;
    }
    projectObj.vendors.push({ name: vendorName });
    projectObj.vendors.sort((a, b) => a.name.localeCompare(b.name));

    if (!updatedTokenSpecificSettings[areaName]) updatedTokenSpecificSettings[areaName] = {};
    if (!updatedTokenSpecificSettings[areaName][projectName]) updatedTokenSpecificSettings[areaName][projectName] = {};
    if (!updatedTokenSpecificSettings[areaName][projectName][vendorName]) {
        updatedTokenSpecificSettings[areaName][projectName][vendorName] = { ...initialTokenValues };
    }
    
    try {
      updatedTokenHierarchy.sort((a,b) => a.name.localeCompare(b.name));
      await saveHierarchyToFirestore(tokenName, updatedTokenHierarchy);
      await saveSettingsToFirestore(tokenName, updatedTokenSpecificSettings);
      
      setAreaHierarchy(prev => ({...prev, [tokenName]: updatedTokenHierarchy}));
      setTokenSettings(prev => ({...prev, [tokenName]: updatedTokenSpecificSettings}));
      setSelectedHierarchy(prevSelected => ({
          ...prevSelected,
          [tokenName]: { area: areaName, project: projectName, vendor: vendorName }
      }));
      toast({ title: "Hierarki Ditambahkan", description: `Hierarki "${areaName} > ${projectName} > ${vendorName}" untuk ${displayName} berhasil ditambahkan.` });
    } catch (error) { 
    }

    setShowAddHierarchyDialog(false);
    setActiveTokenForHierarchyModal(null);
  };

  const handleOpenEditHierarchyDialog = (tokenNameToEdit: string) => {
    if (user?.role === UserRole.VENDOR) {
        toast({title: "Aksi Tidak Diizinkan", description: "Vendor tidak dapat mengubah hierarki.", variant: "destructive"});
        return;
    }
    const currentSelection = selectedHierarchy[tokenNameToEdit];
    if (!currentSelection || !currentSelection.area || !currentSelection.project || !currentSelection.vendor ) {
      toast({ title: "Aksi Tidak Valid", description: "Pilih Area, Project, dan Vendor terlebih dahulu.", variant: "destructive" });
      return;
    }
    setHierarchyToEdit({
        tokenName: tokenNameToEdit,
        area: currentSelection.area,
        project: currentSelection.project,
        vendor: currentSelection.vendor
    });
    setEditedAreaNameInput(currentSelection.area);
    setEditedProjectNameInput(currentSelection.project);
    setEditedVendorNameInput(currentSelection.vendor);
    setShowEditHierarchyDialog(true);
  };

 const handleConfirmEditHierarchy = async () => {
    if (user?.role === UserRole.VENDOR) return;
    if (!hierarchyToEdit) return;
    const { tokenName, area: oldAreaName, project: oldProjectName, vendor: oldVendorName } = hierarchyToEdit;
    const currentTokenData = tokenTypes.find(t => t.name === tokenName);
    const displayName = currentTokenData?.displayName || tokenName;

    const newAreaName = editedAreaNameInput.trim();
    const newProjectName = editedProjectNameInput.trim();
    const newVendorName = editedVendorNameInput.trim();

    if (!newAreaName || !newProjectName || !newVendorName) {
      toast({ title: "Kesalahan Validasi", description: "Nama Area, Project, dan Vendor harus diisi.", variant: "destructive" });
      return;
    }
    if (!allGlobalVendors.find(v => v.name === newVendorName)) {
        toast({ title: "Kesalahan Validasi", description: `Vendor "${newVendorName}" tidak ditemukan. Pilih dari daftar vendor global.`, variant: "destructive" });
        return;
    }
    const globalVendorSelected = allGlobalVendors.find(v => v.name === newVendorName);
    if (globalVendorSelected && Array.isArray(globalVendorSelected.handledServices) && !globalVendorSelected.handledServices.includes(tokenName)) {
        toast({ title: "Kesalahan Validasi", description: `Vendor "${newVendorName}" tidak menangani jenis token ${displayName}. Pilih vendor yang sesuai.`, variant: "destructive" });
        return;
    }

    let updatedTokenHierarchy = JSON.parse(JSON.stringify(areaHierarchy[tokenName] || [])) as AreaHierarchy;
    let updatedTokenSpecificSettings = JSON.parse(JSON.stringify(tokenSettings[tokenName] || {})) as AllTokenSettings[string];

    const oldAreaIndex = updatedTokenHierarchy.findIndex(a => a.name === oldAreaName);
    if (oldAreaIndex === -1) {
        toast({ title: "Error", description: `Area lama "${oldAreaName}" tidak ditemukan.`, variant: "destructive" });
        return;
    }
    
    const projectToModifyIndex = updatedTokenHierarchy[oldAreaIndex].projects.findIndex(p => p.name === oldProjectName);
    if (projectToModifyIndex === -1) {
        toast({ title: "Data Error", description: `Project "${oldProjectName}" tidak dapat diakses.`, variant: "destructive" });
        return;
    }
    const projectToModify = updatedTokenHierarchy[oldAreaIndex].projects[projectToModifyIndex];

    if (!projectToModify) {
        toast({ title: "Data Error Kritis", description: `Struktur project ${oldProjectName} korup.`, variant: "destructive" });
        return;
    }
    
    if (!Array.isArray(projectToModify.vendors)) { 
        projectToModify.vendors = [];
    }

    const oldVendorIndex = projectToModify.vendors.findIndex(v => v.name === oldVendorName);
    const oldSettingsForVendor = updatedTokenSpecificSettings[oldAreaName]?.[oldProjectName]?.[oldVendorName];

    if (oldVendorIndex !== -1) {
        projectToModify.vendors.splice(oldVendorIndex, 1);
    }
    if (updatedTokenSpecificSettings[oldAreaName]?.[oldProjectName]) {
        delete updatedTokenSpecificSettings[oldAreaName][oldProjectName][oldVendorName];
    }

    if (projectToModify.vendors.length === 0) {
        updatedTokenHierarchy[oldAreaIndex].projects.splice(projectToModifyIndex, 1);
        if (updatedTokenSpecificSettings[oldAreaName]?.[oldProjectName] && Object.keys(updatedTokenSpecificSettings[oldAreaName][oldProjectName]).length === 0) {
            delete updatedTokenSpecificSettings[oldAreaName][oldProjectName];
        }
    }
    if (updatedTokenHierarchy[oldAreaIndex].projects.length === 0) {
        updatedTokenHierarchy.splice(oldAreaIndex, 1);
        if (updatedTokenSpecificSettings[oldAreaName] && Object.keys(updatedTokenSpecificSettings[oldAreaName]).length === 0) {
            delete updatedTokenSpecificSettings[oldAreaName];
        }
    }
    
    let newAreaObj = updatedTokenHierarchy.find(a => a.name === newAreaName);
    if (!newAreaObj) {
        newAreaObj = { name: newAreaName, projects: [] };
        updatedTokenHierarchy.push(newAreaObj);
    }
    let newProjectObj = newAreaObj.projects.find(p => p.name === newProjectName);
    if (!newProjectObj) {
        newProjectObj = { name: newProjectName, vendors: [] };
        newAreaObj.projects.push(newProjectObj);
    }
    if (!Array.isArray(newProjectObj.vendors)) { 
        newProjectObj.vendors = [];
    }

    if (!newProjectObj.vendors.some(v => v.name === newVendorName)) {
        newProjectObj.vendors.push({ name: newVendorName });
        newProjectObj.vendors.sort((a,b) => a.name.localeCompare(b.name));
    } else if (newAreaName !== oldAreaName || newProjectName !== oldProjectName || newVendorName !== oldVendorName) { 
         toast({ title: "Entri Duplikat", description: `Vendor "${newVendorName}" sudah ada di Project "${newProjectName}" Area "${newAreaName}" untuk token ${displayName}. Pengeditan dibatalkan.`, variant: "destructive" });
         return;
    }

    if (!updatedTokenSpecificSettings[newAreaName]) updatedTokenSpecificSettings[newAreaName] = {};
    if (!updatedTokenSpecificSettings[newAreaName][newProjectName]) updatedTokenSpecificSettings[newAreaName][newProjectName] = {};
    updatedTokenSpecificSettings[newAreaName][newProjectName][newVendorName] = oldSettingsForVendor || { ...initialTokenValues };

    try {
      updatedTokenHierarchy.sort((a,b) => a.name.localeCompare(b.name));
      await saveHierarchyToFirestore(tokenName, updatedTokenHierarchy);
      await saveSettingsToFirestore(tokenName, updatedTokenSpecificSettings);

      setAreaHierarchy(prev => ({...prev, [tokenName]: updatedTokenHierarchy}));
      setTokenSettings(prev => ({...prev, [tokenName]: updatedTokenSpecificSettings}));
      setSelectedHierarchy(prevSelected => ({
        ...prevSelected,
        [tokenName]: { area: newAreaName, project: newProjectName, vendor: newVendorName }
      }));
      toast({ title: "Hierarki Diperbarui", description: `Hierarki untuk ${displayName} telah diperbarui menjadi "${newAreaName} > ${newProjectName} > ${newVendorName}".` });
    } catch (error) { }

    setShowEditHierarchyDialog(false);
    setHierarchyToEdit(null);
  };

  const handleOpenDeleteHierarchyAlert = (tokenNameToDeleteFrom: string) => {
    if (user?.role === UserRole.VENDOR) {
        toast({title: "Aksi Tidak Diizinkan", description: "Vendor tidak dapat menghapus hierarki.", variant: "destructive"});
        return;
    }
    const currentSelection = selectedHierarchy[tokenNameToDeleteFrom];
    if (!currentSelection || !currentSelection.area || !currentSelection.project || !currentSelection.vendor) {
       toast({ title: "Aksi Tidak Valid", description: "Pilih Area, Project, dan Vendor untuk dihapus.", variant: "destructive" });
      return;
    }
    setHierarchyToDelete({
        tokenName: tokenNameToDeleteFrom,
        area: currentSelection.area,
        project: currentSelection.project,
        vendor: currentSelection.vendor
    });
    setShowDeleteHierarchyAlert(true);
  };

 const handleActualDeleteHierarchy = async (itemToDelete: {tokenName: string; area: string; project: string; vendor?: string} | null) => {
    if (user?.role === UserRole.VENDOR) return;
    if (!itemToDelete) return;
    const { tokenName, area: areaToDel, project: projectToDel, vendor: vendorToDel } = itemToDelete;
    const currentTokenData = tokenTypes.find(t => t.name === tokenName);
    const displayName = currentTokenData?.displayName || tokenName;

    if (!vendorToDel) { 
        toast({ title: "Error", description: "Vendor tidak spesifik untuk dihapus.", variant: "destructive" });
        return;
    }

    let updatedTokenHierarchy = JSON.parse(JSON.stringify(areaHierarchy[tokenName] || [])) as AreaHierarchy;
    let updatedTokenSpecificSettings = JSON.parse(JSON.stringify(tokenSettings[tokenName] || {})) as AllTokenSettings[string];

    let itemDeleted = false;
    const areaIndex = updatedTokenHierarchy.findIndex(a => a.name === areaToDel);
    if (areaIndex !== -1) {
        const projectIndex = updatedTokenHierarchy[areaIndex].projects.findIndex(p => p.name === projectToDel);
        if (projectIndex !== -1) {
            const projectToModify = updatedTokenHierarchy[areaIndex].projects[projectIndex];
            if (projectToModify && Array.isArray(projectToModify.vendors)) { 
                const vendorIndex = projectToModify.vendors.findIndex(v => v.name === vendorToDel);
                if (vendorIndex !== -1) {
                    projectToModify.vendors.splice(vendorIndex, 1);
                    itemDeleted = true;

                    if (updatedTokenSpecificSettings[areaToDel]?.[projectToDel]?.[vendorToDel]) {
                        delete updatedTokenSpecificSettings[areaToDel][projectToDel][vendorToDel];
                    }

                    if (projectToModify.vendors.length === 0) {
                        updatedTokenHierarchy[areaIndex].projects.splice(projectIndex, 1);
                        if (updatedTokenSpecificSettings[areaToDel]?.[projectToDel] && Object.keys(updatedTokenSpecificSettings[areaToDel][projectToDel]).length === 0) {
                            delete updatedTokenSpecificSettings[areaToDel][projectToDel];
                        }
                    }
                    if (updatedTokenHierarchy[areaIndex].projects.length === 0) {
                        updatedTokenHierarchy.splice(areaIndex, 1);
                         if (updatedTokenSpecificSettings[areaToDel] && Object.keys(updatedTokenSpecificSettings[areaToDel]).length === 0) {
                            delete updatedTokenSpecificSettings[areaToDel];
                        }
                    }
                }
            } else if (projectToModify && !Array.isArray(projectToModify.vendors)) {
               if (updatedTokenSpecificSettings[areaToDel]?.[projectToDel]?.[vendorToDel]) {
                  delete updatedTokenSpecificSettings[areaToDel][projectToDel][vendorToDel];
                  itemDeleted = true; 
                  if (Object.keys(updatedTokenSpecificSettings[areaToDel]?.[projectToDel] || {}).length === 0) {
                    delete updatedTokenSpecificSettings[areaToDel]?.[projectToDel];
                  }
                  if (Object.keys(updatedTokenSpecificSettings[areaToDel] || {}).length === 0) {
                    delete updatedTokenSpecificSettings[areaToDel];
                  }
               }
            }
        }
    }

    if(itemDeleted){
        try {
            await saveHierarchyToFirestore(tokenName, updatedTokenHierarchy);
            await saveSettingsToFirestore(tokenName, updatedTokenSpecificSettings);

            setAreaHierarchy(prev => ({...prev, [tokenName]: updatedTokenHierarchy}));
            setTokenSettings(prev => ({...prev, [tokenName]: updatedTokenSpecificSettings}));
            setSelectedHierarchy(prevSelected => {
              const newSelections = { ...prevSelected };
              if (newSelections[tokenName]?.area === areaToDel &&
                  newSelections[tokenName]?.project === projectToDel &&
                  newSelections[tokenName]?.vendor === vendorToDel) {
                
                const currentTokenHierAfterDelete = updatedTokenHierarchy;
                const firstAreaName = currentTokenHierAfterDelete.length > 0 && currentTokenHierAfterDelete[0] ? currentTokenHierAfterDelete[0].name : '';
                
                let firstProjectName = '';
                if (firstAreaName) {
                    const projectsInFirstArea = getProjectsForArea(tokenName, firstAreaName); 
                    if (projectsInFirstArea.length > 0 && projectsInFirstArea[0]) {
                        firstProjectName = projectsInFirstArea[0].name;
                    }
                }
                
                let firstVendorName = '';
                if (firstAreaName && firstProjectName) {
                    const vendorsInFirstProject = getVendorsForProject(tokenName, firstAreaName, firstProjectName); 
                    if (vendorsInFirstProject.length > 0 && vendorsInFirstProject[0]) {
                        firstVendorName = vendorsInFirstProject[0].name;
                    }
                }
                newSelections[tokenName] = { area: firstAreaName, project: firstProjectName, vendor: firstVendorName };
              }
              return newSelections;
            });
            toast({ title: "Hierarki Dihapus", description: `Hierarki "${areaToDel} > ${projectToDel} > ${vendorToDel}" untuk ${displayName} telah dihapus.` });
        } catch (error) { 
        }
    } else {
        toast({ title: "Info", description: `Vendor "${vendorToDel}" tidak ditemukan untuk dihapus pada jalur yang dipilih atau struktur data tidak valid.`, variant: "default"});
    }

    setHierarchyToDelete(null);
    setItemPendingSupervisionDelete(null); 
  };

  const PLACEHOLDER_SUPERVISION_PASSWORD = "admin123"; 

  const handleSupervisionPasswordConfirm = async () => {
    if (!itemPendingSupervisionDelete) return;
    setIsVerifyingPassword(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (supervisionPasswordInput === PLACEHOLDER_SUPERVISION_PASSWORD) {
      toast({ title: "Password Supervisi Diterima", description: "Melanjutkan proses penghapusan..." });
      setShowSupervisionPasswordDialog(false);
      await handleActualDeleteHierarchy(itemPendingSupervisionDelete); 
    } else {
      toast({ title: "Password Supervisi Salah", description: "Penghapusan dibatalkan. Silakan coba lagi.", variant: "destructive" });
    }
    setSupervisionPasswordInput('');
    setIsVerifyingPassword(false);
  };

  const handleUpdateStronpowerCredentials = async () => {
    setIsSavingStronpowerCreds(true);
    const credsToSave = {
        apiUrl: stronpowerApiUrl,
        companyName: stronpowerCompanyName,
        userName: stronpowerUserName,
        password: stronpowerPassword,
    };
    try {
        const credsDocRef = doc(db, 'appConfiguration', 'stronpowerApiCredentials');
        await setDoc(credsDocRef, credsToSave, { merge: true }); 
        toast({ title: "Kredensial API Disimpan", description: "Kredensial API Stronpower telah berhasil diperbarui." });
        setIsStronpowerCredsEditing(false);
    } catch (error) {
        console.error("Error saving Stronpower API credentials:", error);
        toast({ title: "Gagal Menyimpan Kredensial", description: (error as Error).message, variant: "destructive" });
    } finally {
        setIsSavingStronpowerCreds(false);
    }
  };


  if (isLoadingData && !user) { // Show loading only if user isn't loaded yet
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary mr-2" />
        <span className="text-lg font-medium text-muted-foreground">Memeriksa sesi pengguna...</span>
      </div>
    );
  }
  
  if (!user) { // If still no user after loading, means not logged in
    return (
        <div className="container mx-auto py-8 px-4 md:px-0 space-y-8">
            <Card className="shadow-xl"><CardHeader><CardTitle>Akses Ditolak</CardTitle></CardHeader><CardContent><p>Silakan login untuk mengakses halaman ini.</p></CardContent></Card>
        </div>
    );
  }
  
  // User is loaded, now check if data is still loading
  if (isLoadingData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary mr-2" />
        <span className="text-lg font-medium text-muted-foreground">Memuat data token management...</span>
      </div>
    );
  }


  return (
    <div className="container mx-auto py-8 px-4 md:px-0 space-y-8">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex items-center space-x-2 mb-2">
            <Shapes className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold tracking-tight">Pengaturan Harga Token</CardTitle>
          </div>
          <CardDescription className="text-lg text-muted-foreground">
            Pilih jenis token dan Area Project di bawah untuk mengatur penetapan harga.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6 pt-6">
          {tokenTypes.map((token) => {
            const currentTokenName = token.name;
            // For vendors, areaHierarchy for this tokenName might be empty if they don't handle it or aren't in any hierarchy for it.
            if (user.role === UserRole.VENDOR && (!areaHierarchy[currentTokenName] || areaHierarchy[currentTokenName].length === 0)) {
                return null; // Skip rendering this card if vendor doesn't have access/hierarchy for this token type
            }

            const currentTokenSpecificHierarchy = areaHierarchy[currentTokenName] || [];
            const currentSelection = selectedHierarchy[currentTokenName] || { area: '', project: '', vendor: '' };
            const currentSettingsForPath = tokenSettings[currentTokenName]?.[currentSelection.area]?.[currentSelection.project]?.[currentSelection.vendor] || initialTokenValues;
            const isEditing = editModes[currentTokenName];

            let projectsForSelectedArea: HierarchyProject[] = [];
            if (currentSelection.area) {
                projectsForSelectedArea = getProjectsForArea(currentTokenName, currentSelection.area);
            }
            
            let vendorsForSelectedProject: VendorInProject[] = [];
            if (currentSelection.area && currentSelection.project) {
                vendorsForSelectedProject = getVendorsForProject(currentTokenName, currentSelection.area, currentSelection.project);
            }

            const isFullHierarchySelected = !!(currentSelection.area && currentSelection.project && currentSelection.vendor);
            const isAreaProjectSelected = !!(currentSelection.area && currentSelection.project);

            return (
              <Card
                key={currentTokenName}
                className="hover:shadow-lg transition-shadow duration-300 ease-in-out flex flex-col"
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-semibold">{token.displayName}</CardTitle>
                  <token.icon className="h-7 w-7 text-muted-foreground" />
                </CardHeader>
                <CardContent className="flex-grow flex flex-col pt-4">
                  <p className="text-sm text-muted-foreground mb-4">{token.description}</p>

                  <div className="mb-3">
                    <Label htmlFor={`${currentTokenName}-area`} className="text-xs font-medium">Area Project</Label>
                    <Select value={currentSelection.area} onValueChange={(value) => handleAreaChange(currentTokenName, value)} disabled={isEditing}>
                      <SelectTrigger id={`${currentTokenName}-area`} className="h-8 text-sm">
                        <SelectValue placeholder={currentTokenSpecificHierarchy.length === 0 ? "Tidak ada area" : "Pilih Area"} />
                      </SelectTrigger>
                      <SelectContent>
                        {currentTokenSpecificHierarchy.map(area => <SelectItem key={area.name} value={area.name} className="text-sm">{area.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mb-3">
                    <Label htmlFor={`${currentTokenName}-project`} className="text-xs font-medium">Project</Label>
                    <Select
                      value={currentSelection.project}
                      onValueChange={(value) => handleProjectChange(currentTokenName, value)}
                      disabled={isEditing || !currentSelection.area}
                    >
                      <SelectTrigger id={`${currentTokenName}-project`} className="h-8 text-sm">
                        <SelectValue placeholder={!currentSelection.area ? "Pilih Area Project dulu" : (projectsForSelectedArea.length === 0 ? "Tidak ada project" : "Pilih Project")} />
                      </SelectTrigger>
                      <SelectContent>
                        {projectsForSelectedArea.map(proj => <SelectItem key={proj.name} value={proj.name} className="text-sm">{proj.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="mb-4">
                    <Label htmlFor={`${currentTokenName}-vendor`} className="text-xs font-medium">Vendor</Label>
                    <Select
                      value={currentSelection.vendor}
                      onValueChange={(value) => handleVendorChange(currentTokenName, value)}
                      disabled={isEditing || !isAreaProjectSelected || (user?.role === UserRole.VENDOR && vendorsForSelectedProject.length <= 1)}
                    >
                      <SelectTrigger id={`${currentTokenName}-vendor`} className="h-8 text-sm">
                         <SelectValue placeholder={
                           !isAreaProjectSelected ? "Pilih Project dulu" : 
                           (!vendorsForSelectedProject || vendorsForSelectedProject.length === 0 ? "Tidak ada vendor terhubung" : "Pilih Vendor")
                         } />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(vendorsForSelectedProject) && vendorsForSelectedProject.map(vend => <SelectItem key={vend.name} value={vend.name} className="text-sm">{vend.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {user?.role !== UserRole.VENDOR && (
                    <div className="flex space-x-2 mb-4">
                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleOpenAddHierarchyDialog(currentTokenName)} disabled={isEditing}>
                        <PlusCircle className="mr-1 h-3 w-3" /> Area Project
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleOpenEditHierarchyDialog(currentTokenName)} disabled={!isFullHierarchySelected || isEditing}>
                        <EditIcon className="mr-1 h-3 w-3" /> Edit
                        </Button>
                        <Button size="sm" variant="destructive" className="flex-1 text-xs" onClick={() => handleOpenDeleteHierarchyAlert(currentTokenName)} disabled={!isFullHierarchySelected || isEditing}>
                        <Trash2 className="mr-1 h-3 w-3" /> Hapus
                        </Button>
                    </div>
                  )}

                  <div className="space-y-3 mb-4">
                    {[
                        {id: 'basePrice', label: basePriceLabels[currentTokenName] || basePriceLabels.DEFAULT, placeholderSuffix: '100.000'},
                        {id: 'pajak', label: 'Pajak (%)', placeholderSuffix: '11'},
                        {id: 'adminFee', label: 'Biaya Admin (Rp)', placeholderSuffix: '2.500'},
                        {id: 'otherCosts', label: 'Biaya Lain-lain (Rp)', placeholderSuffix: '0'},
                    ].map(field => (
                        <div key={field.id}>
                            <Label htmlFor={`${currentTokenName}-${currentSelection.area}-${currentSelection.project}-${currentSelection.vendor}-${field.id}`} className="text-xs font-medium">
                                {field.label}
                            </Label>
                            <Input
                                id={`${currentTokenName}-${currentSelection.area}-${currentSelection.project}-${currentSelection.vendor}-${field.id}`}
                                type="text"
                                placeholder={!isFullHierarchySelected ? "Pilih hierarki dulu" : `mis: ${field.placeholderSuffix}`}
                                className="h-8 text-sm"
                                value={field.id === 'pajak' ? currentSettingsForPath[field.id as keyof TokenSettingValues] : displayFormattedNumber(currentSettingsForPath[field.id as keyof TokenSettingValues])}
                                onChange={(e) => handleInputChange(currentTokenName, field.id as keyof TokenSettingValues, e.target.value)}
                                disabled={!isEditing || !isFullHierarchySelected}
                            />
                        </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-4">
                    <div className="flex space-x-2 mb-4">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleUbahClick(currentTokenName)} disabled={!isFullHierarchySelected}>
                        {isEditing ? 'Batal' : 'Ubah Harga'}
                      </Button>
                      <Button variant="default" size="sm" className="flex-1" onClick={() => handleSimpanClick(currentTokenName)} disabled={!isEditing || !isFullHierarchySelected}>
                        Simpan Harga
                      </Button>
                    </div>
                    <img
                      src={`https://placehold.co/300x200.png`}
                      alt={`${token.displayName} token placeholder`}
                      data-ai-hint={token.dataAiHint}
                      className="w-full h-28 object-cover rounded-md"
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

      {user?.role !== UserRole.VENDOR && (
        <Card className="shadow-xl">
            <CardHeader>
                <div className="flex items-center space-x-2 mb-1">
                    <KeyRound className="h-7 w-7 text-primary" />
                    <CardTitle className="text-2xl font-bold tracking-tight">Kredensial API Stronpower</CardTitle>
                </div>
                <CardDescription className="text-md text-muted-foreground">
                    Kelola kredensial untuk koneksi ke API Vending Stronpower.
                    <br/>
                    <span className="text-xs text-destructive">Perhatian: Mengubah data ini akan berdampak langsung pada kemampuan sistem untuk melakukan vending token.</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                <div>
                    <Label htmlFor="stronpowerApiUrl">API Server URL</Label>
                    <Input
                        id="stronpowerApiUrl"
                        value={stronpowerApiUrl}
                        onChange={(e) => setStronpowerApiUrl(e.target.value)}
                        placeholder="http://www.server-api.stronpower.com/api/VendingMeter"
                        disabled={!isStronpowerCredsEditing || isSavingStronpowerCreds}
                    />
                </div>
                <div>
                    <Label htmlFor="stronpowerCompanyName">Company Name</Label>
                    <Input
                        id="stronpowerCompanyName"
                        value={stronpowerCompanyName}
                        onChange={(e) => setStronpowerCompanyName(e.target.value)}
                        placeholder="Contoh: saitec"
                        disabled={!isStronpowerCredsEditing || isSavingStronpowerCreds}
                    />
                </div>
                <div>
                    <Label htmlFor="stronpowerUserName">User Name</Label>
                    <Input
                        id="stronpowerUserName"
                        value={stronpowerUserName}
                        onChange={(e) => setStronpowerUserName(e.target.value)}
                        placeholder="Contoh: Admin007"
                        disabled={!isStronpowerCredsEditing || isSavingStronpowerCreds}
                    />
                </div>
                <div>
                    <Label htmlFor="stronpowerPassword">Password</Label>
                    <div className="relative">
                        <Input
                            id="stronpowerPassword"
                            type={showStronpowerApiPassword ? "text" : "password"}
                            value={stronpowerPassword}
                            onChange={(e) => setStronpowerPassword(e.target.value)}
                            placeholder="••••••••"
                            disabled={!isStronpowerCredsEditing || isSavingStronpowerCreds}
                            className="pr-10"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowStronpowerApiPassword(!showStronpowerApiPassword)}
                            disabled={!isStronpowerCredsEditing || isSavingStronpowerCreds}
                            aria-label={showStronpowerApiPassword ? "Sembunyikan password API" : "Tampilkan password API"}
                        >
                            {showStronpowerApiPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>
                <div className="flex items-center space-x-2 pt-3">
                    <Button onClick={() => setIsStronpowerCredsEditing(!isStronpowerCredsEditing)} variant="outline" disabled={isSavingStronpowerCreds}>
                        {isStronpowerCredsEditing ? 'Batal' : 'Edit Kredensial'}
                    </Button>
                    {isStronpowerCredsEditing && (
                        <Button onClick={handleUpdateStronpowerCredentials} disabled={isSavingStronpowerCreds}>
                            {isSavingStronpowerCreds && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Simpan Kredensial
                        </Button>
                    )}
                </div>
                <p className="text-xs text-muted-foreground pt-1">Kredensial ini akan digunakan oleh server untuk berkomunikasi dengan API Stronpower.</p>
            </CardContent>
        </Card>
      )}


      <Dialog open={showAddHierarchyDialog} onOpenChange={(isOpen) => {setShowAddHierarchyDialog(isOpen); if(!isOpen) setActiveTokenForHierarchyModal(null);}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Hierarki Baru {activeTokenForHierarchyModal ? `untuk ${tokenTypes.find(t => t.name === activeTokenForHierarchyModal)?.displayName || activeTokenForHierarchyModal}` : ''}</DialogTitle>
            <DialogDescription>
              Masukkan nama untuk Area Project, Project, dan Vendor baru.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newAreaName" className="text-right">Nama Area</Label>
              <Input id="newAreaName" value={newAreaNameInput} onChange={(e) => setNewAreaNameInput(e.target.value)} className="col-span-3" placeholder="mis: Jakarta Pusat"/>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newProjectName" className="text-right">Nama Project</Label>
              <Input id="newProjectName" value={newProjectNameInput} onChange={(e) => setNewProjectNameInput(e.target.value)} className="col-span-3" placeholder="mis: Proyek Gedung A"/>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="newVendorName" className="text-right">Nama Vendor</Label>
                <Select
                    value={newVendorNameInput}
                    onValueChange={setNewVendorNameInput}
                >
                    <SelectTrigger id="newVendorName" className="col-span-3">
                        <SelectValue placeholder="Pilih Vendor Global" />
                    </SelectTrigger>
                    <SelectContent>
                        {allGlobalVendors
                            .filter(vendor => 
                                activeTokenForHierarchyModal &&
                                Array.isArray(vendor.handledServices) && 
                                vendor.handledServices.includes(activeTokenForHierarchyModal)
                            )
                            .map(vendor => (
                                <SelectItem key={vendor.id || vendor.name} value={vendor.name}>{vendor.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
            <Button onClick={handleConfirmAddHierarchy}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditHierarchyDialog} onOpenChange={(isOpen) => {setShowEditHierarchyDialog(isOpen); if(!isOpen) setHierarchyToEdit(null);}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Hierarki {hierarchyToEdit ? `untuk ${tokenTypes.find(t => t.name === hierarchyToEdit.tokenName)?.displayName || hierarchyToEdit.tokenName}` : ''}</DialogTitle>
            {hierarchyToEdit && <DialogDescription>
              Mengedit: {hierarchyToEdit.area} &gt; {hierarchyToEdit.project} &gt; {hierarchyToEdit.vendor}
            </DialogDescription>}
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editedAreaName" className="text-right">Nama Area</Label>
                <Input id="editedAreaName" value={editedAreaNameInput} onChange={(e) => setEditedAreaNameInput(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editedProjectName" className="text-right">Nama Project</Label>
                <Input id="editedProjectName" value={editedProjectNameInput} onChange={(e) => setEditedProjectNameInput(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="editedVendorName" className="text-right">Nama Vendor</Label>
                 <Select
                    value={editedVendorNameInput}
                    onValueChange={setEditedVendorNameInput}
                >
                    <SelectTrigger id="editedVendorName" className="col-span-3">
                        <SelectValue placeholder="Pilih Vendor Global" />
                    </SelectTrigger>
                    <SelectContent>
                        {allGlobalVendors
                            .filter(vendor => 
                                hierarchyToEdit &&
                                hierarchyToEdit.tokenName &&
                                Array.isArray(vendor.handledServices) && 
                                vendor.handledServices.includes(hierarchyToEdit.tokenName)
                            )
                            .map(vendor => (
                                <SelectItem key={vendor.id || vendor.name} value={vendor.name}>{vendor.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </div>
          <DialogFooter>
             <DialogClose asChild><Button variant="outline">Batal</Button></DialogClose>
            <Button onClick={handleConfirmEditHierarchy}>Simpan Perubahan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteHierarchyAlert} onOpenChange={(isOpen) => { if (!isOpen) setHierarchyToDelete(null); setShowDeleteHierarchyAlert(isOpen); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Penghapusan</AlertDialogTitle>
            {hierarchyToDelete && <AlertDialogDescription>
                {`Apakah Anda yakin ingin menghapus hierarki "${hierarchyToDelete.area} > ${hierarchyToDelete.project} > ${hierarchyToDelete.vendor || ''}" untuk token ${tokenTypes.find(t => t.name === hierarchyToDelete.tokenName)?.displayName || hierarchyToDelete.tokenName}? Semua pengaturan token terkait akan ikut terhapus. `}
                <strong className="text-destructive block mt-2">PERHATIAN PENTING:</strong> Pastikan tidak ada pelanggan yang masih terhubung dengan hierarki ini (Area > Project > Vendor). Menghapus hierarki yang masih digunakan dapat menyebabkan pelanggan tidak dapat melakukan transaksi atau mendapatkan harga yang salah. Tindakan ini tidak dapat dibatalkan setelah password supervisi dimasukkan.
            </AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setHierarchyToDelete(null)}>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (hierarchyToDelete) {
                  setItemPendingSupervisionDelete(hierarchyToDelete);
                  setShowDeleteHierarchyAlert(false); 
                  setShowSupervisionPasswordDialog(true); 
                }
              }} 
              className="bg-destructive hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showSupervisionPasswordDialog} onOpenChange={(isOpen) => { if(!isOpen) { setItemPendingSupervisionDelete(null); setSupervisionPasswordInput('');} setShowSupervisionPasswordDialog(isOpen);}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <ShieldAlert className="h-6 w-6 mr-2 text-orange-500" />
              Memerlukan Password Supervisi
            </DialogTitle>
            <DialogDescription>
              Untuk melanjutkan penghapusan, masukkan password supervisi Anda. Ini adalah tindakan ireversibel.
              <br />
              <span className="text-xs text-muted-foreground">(Password demo saat ini: admin123)</span>
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="supervision-password">Password Supervisi</Label>
              <Input 
                id="supervision-password" 
                type="password" 
                value={supervisionPasswordInput}
                onChange={(e) => setSupervisionPasswordInput(e.target.value)}
                placeholder="Masukkan password supervisi" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSupervisionPasswordDialog(false); setItemPendingSupervisionDelete(null); setSupervisionPasswordInput(''); }} disabled={isVerifyingPassword}>
              Batal
            </Button>
            <Button onClick={handleSupervisionPasswordConfirm} disabled={isVerifyingPassword || !supervisionPasswordInput}>
              {isVerifyingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Konfirmasi Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

